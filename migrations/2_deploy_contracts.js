//var TicTacToe = artifacts.require("./TicTacToe.sol");
var Numbers = artifacts.require("./Numbers.sol");

module.exports = function(deployer) {
  //deployer.deploy(TicTacToe);
  deployer.deploy(Numbers);
};
