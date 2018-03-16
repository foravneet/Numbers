pragma solidity ^0.4.19;

contract Numbers {
    uint constant public gameCost = 0.005 ether;
    bool gameActive;
    bool newHandInProgress = false;

    uint8 constant maxNumber = 5;

    // Structs
    struct Player {
        bool[5] hands;
        address addr;
        uint balanceToWithdraw;
        uint8 currentHandPlayed;// 0 means not played yet, specific number means the current hand played
        uint8 wins;
    }

    Player private hostPlayer;
    Player private guestPlayer;
    address public hostPlayerAddr;

    uint constant timeToReact = 3 minutes;
    uint gameValidUntil;


    event PlayerJoined(address player);
    event PlayerPlayedHand(address player, uint8 number);
    event GameOverWithWin(address winner);
    event GameOverWithDraw();
    event HandOverWithWin(address winner);
    event HandOverWithDraw();
    event PayoutSuccess(address receiver, uint amountInWei);

    function Numbers() public payable {
        hostPlayer.addr = msg.sender;
        hostPlayerAddr = msg.sender;
        require(msg.value == gameCost);
        gameValidUntil = now+timeToReact;
    }

    function joinGame() public payable {

        //only one person can join the game..hint.. guestPlayer by default initialized to 0
        require(guestPlayer.addr == address(0));
        gameActive = true;

        require(msg.value == gameCost);

        guestPlayer.addr = msg.sender;
         PlayerJoined(guestPlayer.addr);

        gameValidUntil = now + timeToReact;

    }

    function getPlayStatus() public view returns(bool[5],uint8,uint8,bool[5],uint8,uint8) {
        return (hostPlayer.hands,hostPlayer.currentHandPlayed,hostPlayer.wins,guestPlayer.hands,guestPlayer.currentHandPlayed,guestPlayer.wins);
    }

    function playHand(uint8 number) public {

        require(gameValidUntil > now);
        require(gameActive);
        require(number < maxNumber);

        Player currentPlayer;
        if(msg.sender==hostPlayer.addr)
            currentPlayer = hostPlayer;
        else if(msg.sender==guestPlayer.addr)
            currentPlayer = guestPlayer;

        //first.. check that the user is not taking double turn
        require(currentPlayer.currentHandPlayed==0);//not played already for this hand
        require(currentPlayer.hands[number]==false);// number not used already

        currentPlayer.hands[number] = true;//set hand
        currentPlayer.currentHandPlayed = number;

        PlayerPlayedHand(currentPlayer.addr,number);

       // board[x][y] = msg.sender;
       // movesCounter++;
        gameValidUntil = now + timeToReact;

        // now..check if both players have played
       if((hostPlayer.currentHandPlayed!=0) && (guestPlayer.currentHandPlayed!=0))
            determineHandWinner();
    }

    function determineHandWinner() private{
        if(hostPlayer.currentHandPlayed > guestPlayer.currentHandPlayed)
        {
            ++hostPlayer.wins;
             HandOverWithWin(hostPlayer.addr);
        }
        else if(hostPlayer.currentHandPlayed < guestPlayer.currentHandPlayed)
        {
            ++guestPlayer.wins;
             HandOverWithWin(guestPlayer.addr);
        }
        else
        {
             HandOverWithDraw();//draw
        }

        //reset current hand
        hostPlayer.currentHandPlayed = 0;
        guestPlayer.currentHandPlayed = 0;

        //now check if the game is over overall
        determineOverallWinner();
    }

    function determineOverallWinner() private{
        //if both players took all 5 chances
        if(allChancesTaken(hostPlayer.hands) && allChancesTaken(guestPlayer.hands))
        {
            if(hostPlayer.wins > guestPlayer.wins)
                setWinner(hostPlayer.addr);
            else if(hostPlayer.wins < guestPlayer.wins)
                setWinner(guestPlayer.addr);
            else //draw
                setDraw();
        }

    }

    function allChancesTaken(bool[5] hand) private pure returns(bool){
        bool taken = true;
         for(uint i = 0; i < 5 ; i++) {
             if(hand[i]==false){
                taken=false;
                break;
             }
         }
         return taken;
    }

    function setWinner(address player) private {
        gameActive = false;
        //emit an event
         GameOverWithWin(player);
        uint balanceToPayOut = this.balance;
        if(player.send(balanceToPayOut) != true) {
            if(player == hostPlayer.addr) {
                hostPlayer.balanceToWithdraw = balanceToPayOut;
            } else {
                guestPlayer.balanceToWithdraw = balanceToPayOut;
            }
        } else {
             PayoutSuccess(player, balanceToPayOut);
        }
        //transfer money to the winner
    }

    function withdrawWin() public {
        uint balanceToTransfer;
        if(msg.sender == hostPlayer.addr) {
            require(hostPlayer.balanceToWithdraw > 0);
             balanceToTransfer = hostPlayer.balanceToWithdraw;
            hostPlayer.balanceToWithdraw = 0;
            hostPlayer.addr.transfer(balanceToTransfer);

            PayoutSuccess(hostPlayer.addr, balanceToTransfer);
        } else {

            require(guestPlayer.balanceToWithdraw > 0);
             balanceToTransfer = guestPlayer.balanceToWithdraw;
            guestPlayer.balanceToWithdraw = 0;
            guestPlayer.addr.transfer(balanceToTransfer);
             PayoutSuccess(guestPlayer.addr, balanceToTransfer);
        }
    }

    function setDraw() private {
        gameActive = false;
         GameOverWithDraw();

        uint balanceToPayOut = this.balance/2;

        if(hostPlayer.addr.send(balanceToPayOut) == false) {
            hostPlayer.balanceToWithdraw += balanceToPayOut;
        } else {
             PayoutSuccess(hostPlayer.addr, balanceToPayOut);
        }
        if(guestPlayer.addr.send(balanceToPayOut) == false) {
            guestPlayer.balanceToWithdraw += balanceToPayOut;
        } else {
             PayoutSuccess(guestPlayer.addr, balanceToPayOut);
        }

    }

    function emergencyCashout() public {
        require(gameValidUntil < now);
        require(gameActive);
        setDraw();
    }



}
