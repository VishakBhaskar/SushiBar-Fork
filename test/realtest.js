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

    const TWO_DAYS = (await time.latest()) + 2 * 24 * 60 * 60;
    const FOUR_DAYS = (await time.latest()) + 4 * 24 * 60 * 60;
    const SIX_DAYS = (await time.latest()) + 6 * 24 * 60 * 60;
    const EIGHT_DAYS = (await time.latest()) + 8 * 24 * 60 * 60;
    const NINE_DAYS = (await time.latest()) + 9 * 24 * 60 * 60;
    const THREE_DAYS = (await time.latest()) + 3 * 24 * 60 * 60;

    return {
      sushi,
      sushiBar,
      ramesh,
      suresh,
      pappu,
      chotu,
      TWO_DAYS,
      FOUR_DAYS,
      SIX_DAYS,
      EIGHT_DAYS,
      NINE_DAYS,
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

    it("Should work with 4 users", async function () {
      const { sushi, sushiBar, ramesh } = await loadFixture(deploySushiBar);

      await sushi.connect(ramesh).approve(sushiBar.address, "100");

      const rameshTx1 = await sushiBar.connect(ramesh).enter("50");

      // User pulls out the allowance
      await expect(sushiBar.connect(ramesh).leave("150")).to.be.reverted;
    });
  });
});
