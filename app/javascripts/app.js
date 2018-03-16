// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'
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

//events
//var nextPlayerEvent;
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
        alert("There was an error fetching your accounts.");
        return;
      }

      if (accs.length == 0) {
        alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
        return;
      }

      accounts = accs;
      account = accounts[0];
      arrEventsFired = [];

    });
  },
  //************************
  //******* useAccountOne **********
  //************************
  useAccountOne: function() {
    account = accounts[1];
  },
  //************************
  //******* createNewGame **********
  //************************
  createNewGame: function() {

    Numbers.new({from:account, value:web3.toWei(0.005,"ether"), gas:3000000}).then(instance => {
      numbersInstance = instance;

      console.log(instance);
      $(".in-game").show();
      $(".waiting-for-join").hide();
      $(".game-start").hide();
      $("#game-address").text(instance.address);
      $("#waiting").show();

      playerJoinedEvent = numbersInstance.PlayerJoined();

      playerJoinedEvent.watch(function(error, eventObj) {
        if(!error) {
          console.log(eventObj);
        } else {
          console.error(error);
        }
        $(".waiting-for-join").show();
        $("#opponent-address").text(eventObj.args.player);
        $("#your-turn").hide();
        App.setTableClicks();
        playerJoinedEvent.stopWatching();
      });

      App.registerEvents();
      console.log(instance);
    }).catch(error => {
      console.error(error);
    })
  },
  //************************
  //******* joinGame **********
  //************************
  joinGame: function() {
    var gameAddress = prompt("Address of the Game");
    if(gameAddress != null) {
      Numbers.at(gameAddress).then(instance => {
        numbersInstance = instance;

        App.registerEvents();

        return numbersInstance.joinGame({from:account, value:web3.toWei(0.005, "ether"), gas:3000000});
      }).then(txResult => {
        console.log(numbersInstance);
        console.log(txResult);
        $(".in-game").show();
        $(".game-start").hide();
        $("#game-address").text(numbersInstance.address);
        $("#your-turn").hide();
        numbersInstance.hostPlayerAddr.call().then(senthostPlayerAddr => {
          $("#opponent-address").text(senthostPlayerAddr);
        });
        //print board
        App.printBoard();
        App.setTableClicks();
      }).catch(function(error) {
        console.error('joinGame Error', error);
        })
    }
  },
  //************************
  //******* registerPlayHand **********
  //************************
  registerPlayHand: function(event) {
    console.log("registerPlayHand - ",event);
    //make all cells un clickable while we register this hand
    App.unsetTableClicks();
    //empty the cell text
    $("#board")[0].children[0].children[event.data.x].children[event.data.y].innerHTML == "";
    numbersInstance.playHand(event.data.y, {from: account}).then(txResult => {
      console.log("registerPlayHand event",txResult);
      App.printBoard();
    });
  },
  //************************
  //******* handPlayedEvent **********
  //************************
  handPlayedEvent: function(error, eventObj) {
    console.log("Hand Played - ", eventObj);
    if(arrEventsFired.indexOf(eventObj.blockNumber) === -1) {
      arrEventsFired.push(eventObj.blockNumber);
      App.printBoard();
    if(eventObj.args.player == account) {
        //our turn
      //  Set the On-Click Handler for still remaining numbers
        for(var i = 0; i < 3; i++) {
          for(var j = 0; j < 3; j++) {
            if(i==1) continue; //skip middle row as its not clickable anyway
            if($("#board")[0].children[0].children[i].children[j].innerHTML == "") {
              $($("#board")[0].children[0].children[i].children[j]).off('click').click({x: i, y:j}, App.registerPlayHand);
            }
          }
        }
        $("#your-turn").show();
        $("#waiting").hide();
      } else {
        //opponents turn

        $("#your-turn").hide();
        $("#waiting").show();
      }

    }
  },
  //************************
  //******* handOver **********
  //************************
handOver: function(err, eventObj) {
  console.log("Hand Over", eventObj);
  if(eventObj.event == "HandOverWithWin") {
    if(eventObj.args.winner == account) {
      alert("HAND won !");
    } else {
      alert("HAND lost");
    }
  } else {
    alert("HAND draw");
  }

  //TODO..unset click for just clicked cell

    $(".in-game").hide();
    $(".game-start").show();
},
  //************************
  //******* gameOver **********
  //************************
  gameOver: function(err, eventObj) {
    console.log("Game Over", eventObj);
    if(eventObj.event == "GameOverWithWin") {
      if(eventObj.args.winner == account) {
        alert("Congratulations, You Won!");
      } else {
        alert("Woops, you lost! Try again...");
      }
    } else {
      alert("That's a draw, oh my... next time you do beat'em!");
    }

    App.unRegisterEvents();

    for(var i = 0; i < 3; i++) {
      for(var j = 0; j < 3; j++) {
        if(j==1) continue; //skip middle row as does not display available selections
            $("#board")[0].children[0].children[i].children[j].innerHTML = "";
      }
    }

      $(".in-game").hide();
      $(".game-start").show();
  },
  //************************
  //******* printBoard **********
  //************************
  printBoard: function() {
  console.log('printboard');
    numbersInstance.getPlayStatus.call().then((result) => {
      console.log(result);
      var hostHand = result[0];
      var hostCurrentHandPlayed = result[1];
      var hostWins = result[2];
      var guestHand = result[3];
      var guestCurrentHandPlayed = result[4];
      var guestWins = result[5];
    });
  },
  //************************
  //******* Util functions **********
  //************************
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
        console.log("setTableClicks");
        //make all cells un clickable
        for(var i = 0; i < 3; i++) {
          for(var j = 0; j < 5; j++) {
            if(i==1) continue; //skip middle row as its not clickable anyway
            if($("#board")[0].children[0].children[i].children[j].innerHTML != "")
              $($("#board")[0].children[0].children[i].children[j]).off('click').click({x: i, y:j}, App.registerPlayHand);
          }
        }
      },

      unsetTableClicks: function() {
        console.log("unsetTableClicks");
        //make all cells un clickable
        for(var i = 0; i < 3; i++) {
          for(var j = 0; j < 5; j++) {
            if(i==1) continue; //skip middle row as its not clickable anyway
            $($("#board")[0].children[0].children[i].children[j]).prop('onclick',null).off('click');
          }
        }
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
