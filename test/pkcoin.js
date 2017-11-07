import ether from './helpers/ether'
import advanceToBlock from './helpers/advanceToBlock'
import EVMThrow from './helpers/EVMThrow'

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const PKCoin = artifacts.require("./PKCoin.sol");

const ExampleContest = artifacts.require("./ExampleContest.sol");

//todo: create testcase for underfunded, recover the funds => done
//todo: create testcase for stop ico using state control => done
//todo: create testcase for stop ico using the anyonecanstop function => done
//todo: create testcase for stop + restart => done
 //todo: create testcase for slightly below MAX, burn the extra coins, but keep 70% for initial holder
//todo: test that after paying out rake the sum of all balances plus the unclaimed raikes is equal to total supply - check for eventual rounding errors

//todo check for throw when rejected


contract('PKCoin funded', function (accounts) {


    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedInitialHolder = accounts[4];

    const user1 = accounts[5];
    const user2 = accounts[6];
    const user3 = accounts[7];

    const user1SendFunds = 1;

    const weiICOMaximum = web3.toWei(100000, "ether");
    const weiICOMinimum = 0;
    // must be adapted with number of tests
    const endBlock = 30;

    const silencePeriod = 5;

    // this data structure must be kept in sync with States enum in PKCoin.sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Underfunded: 3, // ICO time finished and minimal amount not raised
        Operational: 4, // manage contests
        Paused: 5         // for contract upgrades
    };

    const exampleContestAddress = "0xf52fe38acefc88635176b617d8ddb1d38a0c61c6";

    const  ContestStates = {
    Preparation: 0,
    Running: 1,
    Completed: 2,
    Abort: 3
    }

    it("should have an address", async function () {
        let PKCoin = await PKCoin.deployed();
        PKCoin.should.exist;
    });

    it("should have an owner from our known accounts", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.stateControl()).should.be.bignumber.equal(expectedStateControl);
        (await pkcoin.whitelistControl()).should.be.bignumber.equal(expectedWhitelist);
        (await pkcoin.withdrawControl()).should.be.bignumber.equal(expectedWithdraw);
        (await pkcoin.initialHolder()).should.be.bignumber.equal(expectedInitialHolder);
    });

    it("should be in Initial state", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should reject setting eth min and max thresholds without stateControlKey.", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(0);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(0);
        await pkcoin.updateEthICOThresholds(weiICOMinimum, weiICOMaximum, 0, endBlock, {from: user1}).should.be.rejected;
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(0);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(0);
        (await pkcoin.endBlock()).should.be.bignumber.equal(0);
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should not let ICO start without correct key or without setting min and max.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.startICO().should.be.rejectedWith(EVMThrow);
        await pkcoin.startICO({from: expectedStateControl}).should.be.rejectedWith(EVMThrow);
    });

    it("should reject max smaller than min values.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.updateEthICOThresholds(weiICOMaximum, weiICOMinimum, 0, endBlock, {from: expectedStateControl}).should.be.rejectedWith(EVMThrow);
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(0);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(0);
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should reject max smaller than min values with negative values.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.updateEthICOThresholds(-1, -5, 0, endBlock, {from: expectedStateControl}).should.be.rejectedWith(EVMThrow);
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(0);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(0);
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });


    it("should accept correct min and max values with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.updateEthICOThresholds(weiICOMinimum, weiICOMaximum, silencePeriod, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(weiICOMinimum);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(weiICOMaximum);
        (await pkcoin.endBlock()).should.be.bignumber.equal(endBlock);
        (await pkcoin.silencePeriod()).should.be.bignumber.equal(silencePeriod);
        (await pkcoin.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO. ", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.startICO({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should not whitelist by default address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(false);
    });

    it("should fail to whitelist address user1 without correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.addToWhitelist(user1).should.be.rejectedWith(EVMThrow);
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(false);
    });

    it("should fail to accept funds from non whitelisted address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.sendTransaction({from: user1, value: web3.toWei(1, "ether")}).should.be.rejectedWith(EVMThrow);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should fail to accept funds during silence period.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.sendTransaction({from: user1, value: web3.toWei(1, "ether")}).should.be.rejectedWith(EVMThrow);
        await advanceToBlock(23);
    });

    it("should accept funds from  whitelisted address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        const preBalance =  web3.eth.getBalance(pkcoin.address);
        preBalance.should.be.bignumber.equal(0);
        isUser1Whitelisted.should.equal(true);
        const etherSentToContract = ether(user1SendFunds);
        const sendTransaction = pkcoin.sendTransaction({from: user1, value: etherSentToContract});
        const chaiForwardTX = await sendTransaction.should.not.be.rejected;
        const newBalance = web3.eth.getBalance(pkcoin.address);
        preBalance.plus(etherSentToContract).should.be.bignumber.equal(newBalance);
        const firstEvent = chaiForwardTX.logs[0];
        firstEvent.event.should.be.equal('Credited');
        // Credited(addr: 0xb3362e3d4605d0878d812e8c2393b2810d96066d, balance: 6e+21, txAmount: 1000000000000000000)
        firstEvent.args.addr.should.be.equal(user1);
        const expectedpkcoinAmount = 6e+21;
        firstEvent.args.balance.should.be.bignumber.equal(expectedpkcoinAmount);
        firstEvent.args.txAmount.should.be.bignumber.equal(etherSentToContract);
    });

    it("should fail to accept funds above the limit from whitelisted address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.sendTransaction({
            from: user1,
            value: web3.toWei(weiICOMaximum + 1, "ether")
        }).should.be.rejectedWith(EVMThrow);
    });

    it("should fail to stop ICO by anyone before ICO timeout.", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
        await pkcoin.anyoneEndICO().should.be.rejected;
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should reject funds from whitelisted address user1 after ICO timeout.", async function () {
        let pkcoin = await pkcoin.deployed();
        await advanceToBlock(endBlock + 1);
        await pkcoin.sendTransaction({from: user1, value: web3.toWei(1, "ether")}).should.be.rejectedWith(EVMThrow);
    });

    it("should accept stopping ICO by anyone after ICO timeout.", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
        await pkcoin.anyoneEndICO().should.not.be.rejected;
        (await pkcoin.state()).should.not.be.bignumber.equal(States.Ico);
        if (weiICOMinimum === 0) {
            (await pkcoin.state()).should.be.bignumber.equal(States.Operational);
        }
    });

    it("should create a contest.", async function () {
        let pkcoin = await pkcoin.deployed();
        let aContest = ExampleContest.at(exampleContestAddress); // deployed();
        //let aContest = ExampleContest.deployed();
        // await aContest.tokensParticipated.should.be.bignumber.equal(0);
        // (await pkcoin.balanceOf(aContest)).should.be.bignumber.equal(aContest.tokensParticipated);
        (await aContest.state()).should.be.bignumber.equal(ContestStates.Preparation);
        await aContest.startContest();
    });


    it("should let user1 participate.", async function () {
        const expectedpkcoinAmount = 6e+21;
        const pointMultiplier = 1000000000000000000;
        let pkcoin = await pkcoin.deployed();
        let aContest = ExampleContest.at(exampleContestAddress); // deployed();
        //let aContest = ExampleContest.deployed();
        // await aContest.tokensParticipated.should.be.bignumber.equal(0);
        // (await pkcoin.balanceOf(aContest)).should.be.bignumber.equal(aContest.tokensParticipated);
        (await aContest.state()).should.be.bignumber.equal(ContestStates.Running);
        let user1Balance = await pkcoin.balanceOf(user1);
        let totalSupply = await pkcoin.totalSupply();

        user1Balance.should.be.bignumber.equal(expectedpkcoinAmount);
        let user1Round = user1Balance.dividedBy(10);
        await pkcoin.transfer(aContest.address, user1Round, {from: user1});
        let user1BalanceStart = await pkcoin.balanceOf(user1);
        await aContest.endContest(user1);
        (await aContest.state()).should.be.bignumber.equal(ContestStates.Completed);
        let newUser1Balance = await pkcoin.balanceOf(user1);
        // our own calculation
        //let user1BalanceStartAndCustomReward = await user1BalanceStart.add(user1Round.times(100).dividedBy(101) );
        // current exact value
        let user1BalanceStartAndCustomReward = 5.9958398e+21;
        // let user1Rakes = basicPoints.dividedBy(pointMultiplier);

        newUser1Balance.toPrecision(8).should.be.bignumber.equal(user1BalanceStartAndCustomReward.toPrecision(8));
        // difference with precision higher than 8 should be equal to rakeOwing(user1)
        //   -5.994059423744730904519e+21
        //   +5.99405940594059405940594059405940594059405e+21


    });
    // Rakes are paid correctly
    // rakes should not increase or decrease totalSupply
    // modifiers should reject out of range values

});





contract('pkcoin funded and stopped by admin and operational.', function (accounts) {

    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedInitialHolder = accounts[4];

    const user1 = accounts[5];
    const user2 = accounts[6];
    const user3 = accounts[7];

    const weiICOMaximum = web3.toWei(100001, "ether");
    const weiICOMinimum = web3.toWei(0, "ether");
    // must be adapted with number of tests
    const endBlock = 20;

    const user1SendFunds = 1;

    // this data structure must be kept in sync with States enum in pkcoin.sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Underfunded: 3, // ICO time finished and minimal amount not raised
        Operational: 4, // manage contests
        Paused: 5         // for contract upgrades
    }

    it("should be in Initial state", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept valid min and max values with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.updateEthICOThresholds(weiICOMinimum, weiICOMaximum, 0, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(weiICOMinimum);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(weiICOMaximum);
        (await pkcoin.endBlock()).should.be.bignumber.equal(endBlock);
        (await pkcoin.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO. ", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.startICO({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should accept funds from  whitelisted address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
        await pkcoin.sendTransaction({from: user1, value: ether(user1SendFunds)}).should.not.be.rejected;
    });

    it("should accept stopping ICO by admin before ICO timeout.", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
        await pkcoin.endICO({from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.state()).should.not.be.bignumber.equal(States.Ico);
        if (weiICOMinimum === 0) {
            (await pkcoin.state()).should.be.bignumber.equal(States.Operational);
        }
    });

});


contract('pkcoin accepts large numbers of ICO invests small and large but respects cap. Funded and stopped by admin and operational.', function (accounts) {

    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedInitialHolder = accounts[4];

    const user1 = accounts[5];
    const user2 = accounts[6];
    const user3 = accounts[7];

    const weiICOMaximum = web3.toWei(0.64, "ether");
    const weiICOMinimum = web3.toWei(0.064, "ether");
    // must be adapted with number of tests
    const endBlock = 200;

    // this data structure must be kept in sync with States enum in pkcoin.sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Underfunded: 3, // ICO time finished and minimal amount not raised
        Operational: 4, // manage contests
        Paused: 5         // for contract upgrades
    }

    it("should be in Initial state", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept valid min and max values with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.updateEthICOThresholds(weiICOMinimum, weiICOMaximum, 0, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(weiICOMinimum);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(weiICOMaximum);
        (await pkcoin.endBlock()).should.be.bignumber.equal(endBlock);
        (await pkcoin.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO. ", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.startICO({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should accept lots of small funds from  whitelisted address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        const preBalance =  web3.eth.getBalance(pkcoin.address);
        preBalance.should.be.bignumber.equal(0);
        let currentBalance = new BigNumber(0);
        const user1SendFunds = 0.001;
        isUser1Whitelisted.should.equal(true);
        for(let i=0; i < 100; i++) {
            await pkcoin.sendTransaction({from: user1, value: ether(user1SendFunds)}).should.not.be.rejected;
            const postBalance =  web3.eth.getBalance(pkcoin.address);
            currentBalance = currentBalance.plus(ether(user1SendFunds));
            currentBalance.should.be.bignumber.equal(postBalance);
        }
        const postBalance =  web3.eth.getBalance(pkcoin.address);
        let remaining = new BigNumber(weiICOMaximum).minus(postBalance);
        let aBitTooMuch = remaining.plus(ether(0.001));
        await pkcoin.sendTransaction({from: user1, value: aBitTooMuch}).should.be.rejected;
        await pkcoin.sendTransaction({from: user1, value: remaining}).should.not.be.rejected;
        const finalBalance =  web3.eth.getBalance(pkcoin.address);
        currentBalance = currentBalance.plus(remaining);
        currentBalance.should.be.bignumber.equal(finalBalance);

    });

    it("should accept stopping ICO by admin before ICO timeout.", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
        await pkcoin.endICO({from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.state()).should.not.be.bignumber.equal(States.Ico);
        if (weiICOMinimum === 0) {
            (await pkcoin.state()).should.be.bignumber.equal(States.Operational);
        }
    });

});

contract('pkcoin funded and stopped by admin and underfunded.', function (accounts) {

    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedInitialHolder = accounts[4];

    const user1 = accounts[5];
    const user2 = accounts[6];
    const user3 = accounts[7];

    const weiICOMaximum = web3.toWei(100001, "ether");
    const weiICOMinimum = web3.toWei(100000, "ether");
    // must be adapted with number of tests
    const endBlock = 20;

    const user1SendFunds = 1;

    // this data structure must be kept in sync with States enum in pkcoin.sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Underfunded: 3, // ICO time finished and minimal amount not raised
        Operational: 4, // manage contests
        Paused: 5         // for contract upgrades
    }

    it("should be in Initial state", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept valid min and max values with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.updateEthICOThresholds(weiICOMinimum, weiICOMaximum, 0, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(weiICOMinimum);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(weiICOMaximum);
        (await pkcoin.endBlock()).should.be.bignumber.equal(endBlock);
        (await pkcoin.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO. ", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.startICO({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should accept funds from  whitelisted address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
        await pkcoin.sendTransaction({from: user1, value: ether(user1SendFunds)}).should.not.be.rejected;
    });

    it("should accept stopping ICO by admin before ICO timeout.", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
        await pkcoin.endICO({from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.state()).should.not.be.bignumber.equal(States.Ico);
        if (weiICOMinimum === 0) {
            (await pkcoin.state()).should.be.bignumber.equal(States.Underfunded);
        }
    });

});




contract('pkcoin underfunded and refund.', function (accounts) {

    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedInitialHolder = accounts[4];

    const user1 = accounts[5];
    const user2 = accounts[6];
    const user3 = accounts[7];

    const weiICOMaximum = web3.toWei(100001, "ether");
    const weiICOMinimum = web3.toWei(100000, "ether");
    // must be adapted with number of tests
    const endBlock = 20;

    const user1SendFunds = 1;

    // this data structure must be kept in sync with States enum in pkcoin.sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Underfunded: 3, // ICO time finished and minimal amount not raised
        Operational: 4, // manage contests
        Paused: 5         // for contract upgrades
    }

    it("should be in Initial state", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept valid min and max values with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.updateEthICOThresholds(weiICOMinimum, weiICOMaximum, 0, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(weiICOMinimum);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(weiICOMaximum);
        (await pkcoin.endBlock()).should.be.bignumber.equal(endBlock);
        (await pkcoin.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO. ", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.startICO({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should accept funds from  whitelisted address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
        await pkcoin.sendTransaction({from: user1, value: ether(user1SendFunds)}).should.not.be.rejected;
    });

    it("should not let users get their refund while in ico state.", async function () {
        let pkcoin = await pkcoin.deployed();
        const pre = web3.eth.getBalance(user1);
        await pkcoin.requestRefund({from: user1, gasPrice: 0}).should.be.rejected;
        const post = web3.eth.getBalance(user1);
        post.minus(pre).should.be.bignumber.equal(ether(0));
    });

    it("should move to underfunded state at end of ICO.", async function () {
        let pkcoin = await pkcoin.deployed();
        await advanceToBlock(endBlock + 1);
        await pkcoin.anyoneEndICO().should.not.be.rejected;
        (await pkcoin.state()).should.be.bignumber.equal(States.Underfunded);
    });

    it("should reject new funding in underfunded state.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.sendTransaction({from: user1, value: web3.toWei(1, "ether")}).should.be.rejectedWith(EVMThrow);
    });

    it("should let users get their refund in underfunded state.", async function () {
        let pkcoin = await pkcoin.deployed();
        const pre = web3.eth.getBalance(user1);
        await pkcoin.requestRefund({from: user1, gasPrice: 0}).should.not.be.rejected;
        const post = web3.eth.getBalance(user1);
        post.minus(pre).should.be.bignumber.equal(ether(user1SendFunds));
    });

    it("should not let users get their refund twice in underfunded state.", async function () {
        let pkcoin = await pkcoin.deployed();
        const pre = web3.eth.getBalance(user1);
        await pkcoin.requestRefund({from: user1, gasPrice: 0}).should.be.rejected;
        const post = web3.eth.getBalance(user1);
        post.minus(pre).should.be.bignumber.equal(ether(0));
    });


    it("should not let users without funds get a refund in underfunded state.", async function () {
        let pkcoin = await pkcoin.deployed();
        const pre = web3.eth.getBalance(user3);
        await pkcoin.requestRefund({from: user3, gasPrice: 0}).should.be.rejected;
        const post = web3.eth.getBalance(user3);
        post.minus(pre).should.be.bignumber.equal(ether(0));
    });


});




contract('pkcoin paused and restarted and aborted', function (accounts) {

    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedInitialHolder = accounts[4];

    const user1 = accounts[5];
    const user2 = accounts[6];
    const user3 = accounts[7];

    const weiICOMaximum = web3.toWei(100001, "ether");
    const weiICOMinimum = web3.toWei(100000, "ether");
    // must be adapted with number of tests
    const endBlock = 20;

    // this data structure must be kept in sync with States enum in pkcoin.sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Underfunded: 3, // ICO time finished and minimal amount not raised
        Operational: 4, // manage contests
        Paused: 5         // for contract upgrades
    }

    it("should be in Initial state", async function () {
        let pkcoin = await pkcoin.deployed();
        (await pkcoin.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept valid min and max values with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.updateEthICOThresholds(weiICOMinimum, weiICOMaximum, 0, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await pkcoin.weiICOMinimum()).should.be.bignumber.equal(weiICOMinimum);
        (await pkcoin.weiICOMaximum()).should.be.bignumber.equal(weiICOMaximum);
        (await pkcoin.endBlock()).should.be.bignumber.equal(endBlock);
        (await pkcoin.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO. ", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.startICO({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should accept funds from  whitelisted address user1.", async function () {
        let pkcoin = await pkcoin.deployed();
        const user1SendFunds = 1;
        let isUser1Whitelisted = await pkcoin.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
        await pkcoin.sendTransaction({from: user1, value: ether(user1SendFunds)}).should.not.be.rejected;
    });


    it("should not move to paused state when called with a user key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.pause().should.be.rejectedWith(EVMThrow);
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should move to paused state when called with state control key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.pause({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Paused);
    });

    it("should not be resumed when called with a user key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.resumeICO().should.be.rejectedWith(EVMThrow);
        (await pkcoin.state()).should.be.bignumber.equal(States.Paused);
    });

    it("should be resumed when called with state control key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.resumeICO({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should move again to paused state when called with state control key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.pause({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Paused);
    });

    it("should be aborted when called with state control key.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.abort({from: expectedStateControl});
        (await pkcoin.state()).should.be.bignumber.equal(States.Underfunded);
    });

    it("should reject new funding in underfunded state.", async function () {
        let pkcoin = await pkcoin.deployed();
        await pkcoin.sendTransaction({from: user1, value: web3.toWei(1, "ether")}).should.be.rejectedWith(EVMThrow);
    });

    it("should let users withdraw funds in underfunded state.", async function () {
        let pkcoin = await pkcoin.deployed();
        // user 1 withdraw funds
    });

});
