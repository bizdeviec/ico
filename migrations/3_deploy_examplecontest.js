const HeroCoin = artifacts.require("./PKCoin.sol");
const ExampleContest = artifacts.require("./ExampleContest.sol");

module.exports = function (deployer, network, account) {

    if (network === "ropsten") {

    } else if (network === "development") {


        PKCoin.deployed().then(function (deployed) {
            console.log("Using deployed pkcoin: ", deployed.address);
            deployer.deploy(ExampleContest, deployed.address).then( function() {
              console.log("Using deployed ExampleContest: " + ExampleContest.address);
            });
        });
    }

};
