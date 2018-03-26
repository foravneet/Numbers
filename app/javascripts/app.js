
//TODO.. better comments
//TODO.. better exception handling

// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import {
  default as Web3
} from 'web3';
import {
  default as contract
} from 'truffle-contract'
//import $ from "jquery";

// Import our contract artifacts and turn them into usable abstractions.
import numbers_artifacts from '../../build/contracts/Numbers.json'

// MetaCoin is our usable abstraction, which we'll use through the code below.
var Numbers = contract(numbers_artifacts);

// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
var accounts;
var account;
var numbersInstance;
var isHost = null;
var isGameOver = false;

// total num of handsover events to expect before game is over
// the following three vars are used to postpone processing gameOver event if..
// ..it arrive out of turn before all handsOver events have been received & processed
const totalNumOfHands = 5;
var isLastHandOver = false;
var gameOverEvent = null;
var gameOverErr = null;

//events
var gameOverWithWinEvent;
var gameOverWithDrawEvent;
var handOverWithWinEvent;
var handOverWithDrawEvent;
var playerJoinedEvent;
var playerPlayedHandEvent;

var arrEventsFired;

window.App = {
    //************************
    //******* start **********
    //************************
    start: function() {
      var self = this;

      // Bootstrap the MetaCoin abstraction for Use.
      Numbers.setProvider(web3.currentProvider);

      // Get the initial account balance so it can be displayed.
      web3.eth.getAccounts(function(err, accs) {
        if (err != null) {
          App.showMessage("There was an error fetching your accounts.");
          return;
        }

        if (accs.length == 0) {
          App.showMessage("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
          return;
        }

        accounts = accs;
        account = accounts[0];
        arrEventsFired = [];

      });
    },
    //************************
    //****** useAccountOne ***
    //************************
    useAccountOne: function() {
      account = accounts[1];
    },
    //************************
    //****** createNewGame ***
    //************************
    createNewGame: function() {

      Numbers.new({
        from: account,
        value: web3.toWei(0.005, "ether"),
        gas: 3000000
      }).then(instance => {
        numbersInstance = instance;

        isHost = true; //set me as host

        $(".in-game").show();
        $(".waiting-for-join").hide();
        $(".game-start").hide();
        $("#game-address").text(instance.address);
        $("#waiting").show();

        playerJoinedEvent = numbersInstance.PlayerJoined();

        playerJoinedEvent.watch(function(error, eventObj) {
          if (!error) {
            console.log(eventObj);
          } else {
            console.error(error);
          }
          $(".waiting-for-join").show();
          $("#opponent-address").text(eventObj.args.player);
          $("#your-turn").hide();
          playerJoinedEvent.stopWatching();
          App.newGameBegins();
        });
        //console.log(instance);
      }).catch(error => {
        App.handleError(error);
      })
    },
    //************************
    //******* joinGame **********
    //************************
    joinGame: function() {
      var gameAddress = prompt("Address of the Game");
      if (gameAddress != null) {
        Numbers.at(gameAddress).then(instance => {
          numbersInstance = instance;

          App.registerEvents();

          return numbersInstance.joinGame({
            from: account,
            value: web3.toWei(0.005, "ether"),
            gas: 3000000
          });
        }).then(txResult => {

          isHost = false; //set me as guest

          $(".in-game").show();
          $(".game-start").hide();
          $("#game-address").text(numbersInstance.address);
          $("#your-turn").hide();

          numbersInstance.hostPlayerAddr.call().then(senthostPlayerAddr => {
            $("#opponent-address").text(senthostPlayerAddr);
          });
          App.newGameBegins();
        }).catch(function(error) {
          console.error('joinGame Error', error);
        })
      }
    },
    newGameBegins: function() {
      //TODO.. reset status tables
      //App.printBoard();
      App.setAllNumbers(); //first set all number cells with numbers
      App.setTableClicks(); //only then call this func as it'll will set clicks only for number cells with text
      App.registerEvents();
      App.showMessage("Select card to start Game..");
    },
    //************************
    //******* registerPlayHand **********
    //************************
    registerPlayHand: function(event) {
      console.log("registerPlayHand - ", event);
      //make all cells un clickable while we register this hand
      App.unsetTableClicks();
      App.showMessage("Wait for opponent's turn..");

      //highlight selected cell
      $("#board tr:nth-child(3) td:nth-child(" + (event.data.y + 1) + ")").addClass("rounded-circle");

      numbersInstance.playHand(event.data.y + 1, {
        from: account,
        gas: 3000000
      })
      /*
      .then(txResult => {
        console.log("registerPlayHand returned --- ", txResult);
        //App.printBoard();

      }).catch(error => {
        App.handleError(error);
      });
      */
    },
    //************************
    //*** handPlayedEvent ****
    //************************
    handPlayedEvent: function(error, eventObj) {
      if (!error) {
        console.log("Hand Played event - ", eventObj);
      } else {
        console.error(error);
      }

      //do not proceed if game overall
      if(isGameOver)
      {
        console.log("Ignore handPlayedEvent since game is already over")
        return;
      }

      console.log("Hand Played - my account = ", account);
      //sometimes this event is coming 2 times for the same block, below chk to handle only once
      /*if (arrEventsFired.indexOf(eventObj.blockNumber) === -1) {
        console.log("PROCESSING - Hand Played event");
        arrEventsFired.push(eventObj.blockNumber);*/

      if (eventObj.args.player != account) {
        console.log('== Setting clicks since other party just played their hand');

        $("#your-turn").show();
        $("#waiting").hide();
      } else {
        //opponents turn
        $("#your-turn").hide();
        $("#waiting").show();
      }

      /*} else {
        console.log("IGNORING - Hand Played event since duplicate");
      }*/
    },
    //************************
    //******* handOver *******
    //************************
    handOver: function(err, eventObj) {
      console.log("--- Hand Over", eventObj);
      var scoreString = null;
      var classString;
      var myHand;
      var theirHand;

      //sometimes this event is coming 2 times for the same block, below chk to handle only once
      if ((arrEventsFired.indexOf(eventObj.blockNumber) === -1) && !isGameOver) {
        console.log("PROCESSING - HandOver event");
        arrEventsFired.push(eventObj.blockNumber);

        if (eventObj.event == "HandOverWithWin") {
          if (eventObj.args.winner == account) {
            App.showMessage("HAND won !");

            classString = "table-success";
          } else {
            App.showMessage("HAND lost");
            classString = "table-info";

          }
        } else if (eventObj.event == "HandOverWithDraw"){
          App.showMessage("HAND draw");
          classString = "table-secondary";
          scoreString = "(" + eventObj.args.hand + "," + eventObj.args.hand + ")";
          myHand = eventObj.args.hand;
          theirHand = eventObj.args.hand;
        } else {
          console.log("-- Coming from GameOver Function: Processing score updates of last hand in handOver function");
        }

        if (isHost == true) {
          $("#myscore").text(eventObj.args.hostWins);
          $("#theirscore").text(eventObj.args.guestWins);
          if (scoreString == null) {
            scoreString = "(" + eventObj.args.hostHand + "," + eventObj.args.guestHand + ")";
            myHand = eventObj.args.hostHand;
            theirHand = eventObj.args.guestHand;
          }
        } else {
          $("#myscore").text(eventObj.args.guestWins);
          $("#theirscore").text(eventObj.args.hostWins);
          if (scoreString == null) {
          scoreString = "(" + eventObj.args.guestHand + "," + eventObj.args.hostHand + ")";
          myHand = eventObj.args.guestHand;
          theirHand = eventObj.args.hostHand;
        }
      }

      //empty the cell text
      //$("#board")[0].children[0].children[event.data.x].children[event.data.y].innerHTML = "";
      //$("#board tr:nth-child(3) td:nth-child(" + (event.data.y + 1) + ")").removeClass("table-success").addClass("table-secondary");
      console.log($("#board"));
      $("#board tr:nth-child(1) td:nth-child(" + theirHand + ")").addClass("rounded-circle", 500, "easeOutBounce");


    //  setTimeout(function() {
        $("#board")[0].children[0].children[0].children[theirHand - 1].innerHTML = "";
        $("#board")[0].children[0].children[2].children[myHand - 1].innerHTML = "";

        //set click for all cells, now that innerText has been reset for teh hand just played
        App.setTableClicks();
        App.showMessage("Select card to Play..");
        console.trace();

        $("#board tr:nth-child(1) td:nth-child(" + theirHand + ")").removeClass("table-info", 200, "easeOutBounce").addClass("table-secondary", 200, "easeOutBounce"); //already added rounded circle class above
        $("#board tr:nth-child(3) td:nth-child(" + myHand + ")").removeClass("table-success", 200, "easeOutBounce").addClass("table-secondary", 200, "easeOutBounce"); //this already has rounded circle
      //}, 500);


      //$('#messages').prepend("<img src='https://media.giphy.com/media/xT1R9GYCO1eRlwxW24/giphy-downsized.gif' />");

      //update progress bar
      $("#scoreprogress").append("<div class=" + classString + " role='progressbar' style='width: 20%'>" + scoreString + "</div>");

      //$(".in-game").hide();
      $(".game-start").show();

      //store total hands over
      isLastHandOver = (eventObj.args.handsCompleted) == (totalNumOfHands);
      console.log("Hand num:" + eventObj.args.handsCompleted + "  Over? - " + isLastHandOver);

      //now check if gameOver event was skipped waiting for last handsOver event
      if(isLastHandOver && gameOverEvent!=null){
        console.log("Special Case: Calling gameOver from handOver");
        App.gameOver(null,gameOverEvent);
      }

    } else {
      console.log("IGNORING - HandOver event since duplicate OR game over");
    }
  },
  
  //************************
  //******* gameOver **********
  //************************
  gameOver: function(err, eventObj) {
    console.log("Game Over called", eventObj);

    if(!isLastHandOver){
      //gameOver event received outOfTurn, lets save it for later
      gameOverEvent = eventObj;
      console.log("Skipping gameOver since all hands not processed yet");
      return;
    }

    console.log("Continue to process gameOver since all hands have been processed");
    isGameOver = true;

    if (eventObj.event == "GameOverWithWin") {
      if (eventObj.args.winner == account) {
        App.showMessage("Congratulations, You Won the Game!");
      } else {
        App.showMessage("Woops, you lost! Try again...");
      }
    } else {
      App.showMessage("That's a draw, oh my... next time you do beat'em!");
    }

    //cleanup
    //App.cleanup();

    //$(".in-game").hide();
    $(".game-start").show();
  },

  //************************
  //******* printBoard **********
  // This function is not valid anymore, as we use HandOver & GameOver alerts now to update score etc.
  //************************
  /*  printBoard: function() {
      console.log('printboard');
      numbersInstance.getPlayStatus.call().then((result) => {
        console.log(result);
        var hostHand = result[0];
        //var hostCurrentHandPlayed = result[1];
        var hostWins = result[1];
        var guestHand = result[2];
        //var guestCurrentHandPlayed = result[4];
        var guestWins = result[3];
        if (isHost == true) {
          $('#myhands > tbody:last-child').append('<tr><td>' + hostWins + '</td><td>' + '?' + '</td><td>' + hostHand + '</td></tr>');
          $('#guesthands > tbody:last-child').append('<tr><td>' + guestWins + '</td><td>' + '?' + '</td><td>' + guestHand + '</td></tr>');
        } else {
          $('#myhands > tbody:last-child').append('<tr><td>' + guestWins + '</td><td>' + '?' + '</td><td>' + guestHand + '</td></tr>');
          $('#guesthands > tbody:last-child').append('<tr><td>' + hostWins + '</td><td>' + '?' + '</td><td>' + hostHand + '</td></tr>');
        }

      });
    },*/

  //************************
  //******* Util functions **********
  //************************
  setAllNumbers: function() {
    for (var i = 0; i < 3; i++)
      for (var j = 0; j < 5; j++) {
        if (i == 1) continue; //skip middle row as its not changed anyway
        $("#board")[0].children[0].children[i].children[j].innerHTML = (j + 1);
      }
  },
  cleanup: function() {
    App.unRegisterEvents();
    App.unsetTableClicks();
    isHost = null;
  },
  handleError: function(error) {
    console.error(error);
    console.trace();
    App.showMessage('Error - Ending game, check javascript console for more details');
    App.cleanup();
  },
  registerEvents: function() {
    gameOverWithWinEvent = numbersInstance.GameOverWithWin();
    gameOverWithWinEvent.watch(App.gameOver);

    gameOverWithDrawEvent = numbersInstance.GameOverWithDraw();
    gameOverWithDrawEvent.watch(App.gameOver);

    handOverWithWinEvent = numbersInstance.HandOverWithWin();
    handOverWithWinEvent.watch(App.handOver);

    handOverWithDrawEvent = numbersInstance.HandOverWithDraw();
    handOverWithDrawEvent.watch(App.handOver);

    playerPlayedHandEvent = numbersInstance.PlayerPlayedHand();
    playerPlayedHandEvent.watch(App.handPlayedEvent);
  },

  unRegisterEvents: function() {
    gameOverWithWinEvent.stopWatching();
    gameOverWithDrawEvent.stopWatching();
    handOverWithWinEvent.stopWatching();
    handOverWithDrawEvent.stopWatching();
    playerPlayedHandEvent.stopWatching();
  },

  setTableClicks: function() {
    console.log("-- setTableClicks");
    //make all cells un clickable
    //  for(var i = 0; i < 3; i++) {
    for (var j = 0; j < 5; j++) {
      //if(i==1) continue; //skip middle row as its not clickable anyway
      //we just need to make the last row clickable
      if ($("#board")[0].children[0].children[2].children[j].innerHTML != "") {
        $($("#board")[0].children[0].children[2].children[j]).off('click').click({
          x: 2,
          y: j
        }, App.registerPlayHand);
        //set hover effect
        $("#board tr:nth-child(3) td:nth-child(" + (j + 1) + ")").addClass("hover-effect");
      }
    }
    //}
  },

  unsetTableClicks: function() {
    console.log("-- unsetTableClicks");
    //make all cells un clickable
    //    for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 5; j++) {
      //  if (i == 1) continue; //skip middle row as its not clickable anyway
      $($("#board")[0].children[0].children[2].children[j]).prop('onclick', null).off('click');
      //unset hover effect
      $("#board tr:nth-child(3) td:nth-child(" + (j + 1) + ")").removeClass("hover-effect");
    }
    //    }
  },

  showMessage: function(msg) {
    $("#messages").text(msg);
  }
};

window.addEventListener('load', function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://127.0.0.1:9545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:9545"));
  }

  App.start();
});
