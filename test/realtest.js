const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  days,
} = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration");

describe("SushiBar", function () {
  async function deploySushiBar() {
    const [ramesh, suresh, pappu, chotu] = await ethers.getSigners();
    const SushiBarFactory = await ethers.getContractFactory("SushiBar");
    const SushiFactory = await ethers.getContractFactory("SushiToken");

    const sushi = await SushiFactory.deploy();
    const sushiBar = await SushiBarFactory.deploy(sushi.address);
    await sushi.mint(ramesh.address, "200");
    await sushi.mint(suresh.address, "200");
    await sushi.mint(pappu.address, "200");
    await sushi.mint(chotu.address, "200");

    const SEVEN_DAYS = (await time.latest()) + 7 * 24 * 60 * 60;
    const TWENTYSIX_DAYS = (await time.latest()) + 26 * 24 * 60 * 60;
    const SEVENTEEN_DAYS = (await time.latest()) + 17 * 24 * 60 * 60;
    const EIGHT_DAYS = (await time.latest()) + 8 * 24 * 60 * 60;
    const THREE_DAYS = (await time.latest()) + 3 * 24 * 60 * 60;

    return {
      sushi,
      sushiBar,
      ramesh,
      suresh,
      pappu,
      chotu,
      TWENTYSIX_DAYS,
      SEVENTEEN_DAYS,
      EIGHT_DAYS,
      THREE_DAYS,
    };
  }

  describe("Deployment", function () {
    it("Can't enter bar without giving enough allowance", async function () {
      const { sushi, sushiBar, ramesh } = await loadFixture(deploySushiBar);

      // User gives insufficient allowance to Bar contract
      await sushi.connect(ramesh).approve(sushiBar.address, "30");

      // user tries to enter without giving sufficient allowance
      await expect(sushiBar.connect(ramesh).enter("100")).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );

      // User pulls out the allowance
      await expect(
        sushi.connect(ramesh).decreaseAllowance(sushiBar.address, "30")
      ).not.to.be.reverted;

      // User gives sufficient allowance and tries to enter
      await sushi.connect(ramesh).approve(sushiBar.address, "100");
      await expect(sushiBar.connect(ramesh).enter("100")).not.to.be.reverted;
    });

    it("Can't withdraw more than what is staked", async function () {
      const { sushi, sushiBar, ramesh, THREE_DAYS } = await loadFixture(
        deploySushiBar
      );

      // User gives allowance to SushiBar contract

      await sushi.connect(ramesh).approve(sushiBar.address, "100");

      await sushiBar.connect(ramesh).enter("100");
      const rameshTx1 = sushiBar.connect(ramesh).getCurrentTxId();

      await time.increaseTo(THREE_DAYS);

      // User tries to pull out more than staked
      await expect(
        sushiBar.connect(ramesh).leave("200", rameshTx1)
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should work with 1 user", async function () {
      const { sushi, sushiBar, ramesh, EIGHT_DAYS } = await loadFixture(
        deploySushiBar
      );

      await sushi.connect(ramesh).approve(sushiBar.address, "100");

      //Ramesh enters, now there will be 100 sushi tokens locked in contract
      await sushiBar.connect(ramesh).enter("100");
      rameshTx1 = await sushiBar.connect(ramesh).getCurrentTxId();
      expect(await sushi.balanceOf(sushiBar.address)).to.equal("100");

      // Ramesh withdraws partially or fully wthin 8 days, here 100
      // gets 3/4th of what he should be getting
      // = 100*3/4 = 75 and the rest is transferred back to pool
      await time.increaseTo(EIGHT_DAYS);
      await sushiBar.connect(ramesh).leave("100", rameshTx1);
      // Ramesh's balance = prev balance + withdrawn = 100 + 75
      expect(await sushi.balanceOf(ramesh.address)).to.equal("175");
      expect(await sushi.balanceOf(sushiBar.address)).to.equal("25");
    });

    it("Should work with 4 users", async function () {
      const {
        sushi,
        sushiBar,
        ramesh,
        suresh,
        pappu,
        chotu,
        TWENTYSIX_DAYS,
        SEVENTEEN_DAYS,
        EIGHT_DAYS,
        THREE_DAYS,
      } = await loadFixture(deploySushiBar);

      await sushi.connect(ramesh).approve(sushiBar.address, "100");
      await sushi.connect(suresh).approve(sushiBar.address, "100");
      await sushi.connect(pappu).approve(sushiBar.address, "70");
      await sushi.connect(chotu).approve(sushiBar.address, "80");

      //Ramesh enters, now there will be 100 sushi tokens locked in contract
      await sushiBar.connect(ramesh).enter("100");
      rameshTx1 = await sushiBar.connect(ramesh).getCurrentTxId();
      expect(await sushi.balanceOf(sushiBar.address)).to.equal("100");

      // Ramesh withdraws partially or fully wthin 8 days, here 100
      // gets 1/4th of what he should be getting
      // = 100*1/4 = 25 and the rest is transferred back to pool
      await time.increaseTo(THREE_DAYS);
      await sushiBar.connect(ramesh).leave("100", rameshTx1);

      // Ramesh's balance = prev balance + withdrawn = 100 + 75
      // Total supply of Sushibar tokens = 0, since they were burnt during withdrawal
      expect(await sushi.balanceOf(ramesh.address)).to.equal("125");
      expect(await sushi.balanceOf(sushiBar.address)).to.equal("75");

      // Pappu enters and stakes 50, when the pool has 75 sushi tokens in balance
      await sushiBar.connect(pappu).enter("50");
      pappuTx1 = await sushiBar.connect(pappu).getCurrentTxId();
      // Checks if sushi token balance gets updated to 50+75 = 125
      expect(await sushi.balanceOf(sushiBar.address)).to.equal("125");

      await time.increaseTo(EIGHT_DAYS);

      // Total supply of sushibar tokens = 50
      // Sushibar tokens owned by pappu = 50
      // Pappu withdraws after 4 days, gets half of his original amount
      // original amount = 50 * 125/50 = 125
      await sushiBar.connect(pappu).leave("50", pappuTx1);
      // Total sushi with pappu = prev balance + withdrawn = 150 + (125/2) = 62
      expect(await sushi.balanceOf(pappu.address)).to.equal("212");
      expect(await sushi.balanceOf(sushiBar.address)).to.equal("63");

      // Chotu enters by staking 70 while sushi token balance is 63
      await sushiBar.connect(chotu).enter("70");
      chotuTx1 = await sushiBar.connect(chotu).getCurrentTxId();
      // Checks if sushi token balance gets updated to 63 + 70 = 133
      expect(await sushi.balanceOf(sushiBar.address)).to.equal("133");

      await time.increaseTo(SEVENTEEN_DAYS);

      //Chotu withdraws after 8 days and does not get taxed
      // amount = 35*(133/70) = 66
      await sushiBar.connect(chotu).leave("35", chotuTx1);
      // Chotu's balance = prev balance + withdrawn = 130 + 66
      // Chotu only withdrew half so rest of sushi tokens is in the pool
      expect(await sushi.balanceOf(chotu.address)).to.equal("196");

      // Suresh enters by staking 100 while there are
      // 67 sushi tokens and 35 xSuhshi tokens in the pool
      await sushiBar.connect(suresh).enter("100");
      sureshTx1 = await sushiBar.connect(suresh).getCurrentTxId();
      // xSushi minted to suresh = 100*(35/67) = 52
      expect(await sushiBar.balanceOf(suresh.address)).to.equal("52");

      await time.increaseTo(TWENTYSIX_DAYS);

      // Suresh unstakes after 8 days and does not get taxed
      await sushiBar.connect(suresh).leave("52", sureshTx1);

      // Chotu unstakes the remaining tokens
      await sushiBar.connect(chotu).leave("35", chotuTx1);

      // Total supply of xSushi tokens and sushi tokens in the pool becomes zero
      expect(await sushi.balanceOf(sushiBar.address)).to.equal("0");
      expect(await sushiBar.totalSupply()).to.equal("0");
    });
  });
});
