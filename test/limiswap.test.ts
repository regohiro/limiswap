import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "hardhat-deploy-ethers/dist/src/signers";
import { MacroChain, sqrt, tenPow18, tenPow9, toBN, toBNArray, toWei } from "../utils";
import {
  IERC20,
  ISwapRouter,
  ISwapRouter__factory,
  LimiSwap,
  LimiSwap__factory,
  IQuoter__factory,
  IQuoter,
  MockERC20__factory,
} from "../typechain";
import { ExactInputSingleParamsStruct } from "../typechain/ISwapRouter";
import {
  INonfungiblePositionManager,
  INonfungiblePositionManager__factory,
} from "../abis/types";
import { getPrice } from "./utils";
import { MintParamsStruct } from "../abis/types/INonfungiblePositionManager";

chai.use(solidity);
const { expect } = chai;

let macrochain: MacroChain;

let swapRouter: ISwapRouter;
let quoter: IQuoter;
let positionManager: INonfungiblePositionManager;

let limiswap: LimiSwap;
let tokenA: IERC20;
let tokenB: IERC20;

let feeAB: number;

let owner: SignerWithAddress;
let keeper: SignerWithAddress;
let alice: SignerWithAddress;

describe("LimiSwap contract test", () => {
  before(async () => {
    //Initiate MacroChain and accounts
    macrochain = await MacroChain.init();
    const { users } = macrochain;
    owner = users[0];
    keeper = users[1];
    alice = users[2];
  });

  before(async () => {
    //Connect to Router & Quoter
    const routerAddr = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    const quoterAddr = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
    const nonfungiblePositionManagerAddr = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    swapRouter = ISwapRouter__factory.connect(routerAddr, owner);
    quoter = IQuoter__factory.connect(quoterAddr, owner);
    positionManager = INonfungiblePositionManager__factory.connect(nonfungiblePositionManagerAddr, owner);
  });

  before(async () => {
    const { deployer } = macrochain;

    //Deploy LimiSwap
    limiswap = await deployer<LimiSwap__factory>("LimiSwap", [keeper.address, swapRouter.address, quoter.address]);

    console.log("S1");

    //Deploy tokens
    const supply = toWei(1_000_000);
    tokenA = await deployer<MockERC20__factory>("MockERC20", ["a", "A", supply]);
    tokenB = await deployer<MockERC20__factory>("MockERC20", ["b", "B", supply]);

    console.log("S2");

    {
      await tokenA.approve(swapRouter.address, ethers.constants.MaxUint256);
      await tokenA.approve(positionManager.address, ethers.constants.MaxUint256);
      await tokenB.approve(swapRouter.address, ethers.constants.MaxUint256);
      await tokenB.approve(positionManager.address, ethers.constants.MaxUint256);
    }

    console.log("S3");

    {
      feeAB = 3000;
      const price = 100;
      const sqrtPriceX96 = sqrt(toBN(price).mul(tenPow18)).mul(toBN(2).pow(96)).div(tenPow9);

      await positionManager.createAndInitializePoolIfNecessary(tokenA.address, tokenB.address, feeAB, sqrtPriceX96);
    }

    console.log("S4"); 

    {
      const deadline = await limiswap.getTime() + 10;
      const MIN_TICK = -887272;
      const MAX_TICK = -MIN_TICK;
      const price = await getPrice(tokenA, tokenB, feeAB, quoter);
      const amount0 = toWei(100);
      const amount1 = price.mul(100);

      const params: MintParamsStruct = {
        token0: tokenA.address,
        token1: tokenB.address,
        fee: feeAB,
        tickLower: MIN_TICK,
        tickUpper: MAX_TICK,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: 0,
        amount1Min: 0,
        recipient: owner.address,
        deadline,
      }
      await positionManager.mint(params)
    }

    console.log("S5");

  });

  describe("Basic test", () => {
    it("Transfers", async () => {
      await tokenA.transfer(alice.address, toWei(10));
    });

    // Right now, A : B = 1 : 100
    it("Creates order", async () => {
      //Creates A => B limit order of when A : B = 1 : 101
      const price = toWei(101);
      const amountIn = toWei(1.2);
      const tokenIn = tokenA.address;
      const tokenOut = tokenB.address;
      const slippage = 10000;

      await tokenA.connect(alice).approve(limiswap.address, amountIn);
      await limiswap.connect(alice).createOrder(price, amountIn, tokenIn, tokenOut, feeAB, slippage);

      await expect(limiswap.getOrder(1)).not.to.reverted;
    });

    it("Changes the price of A-B so that it meets the price target", async () => {
      const amountIn = toWei(200);
      const deadline = (await limiswap.getTime()) + 100;

      //Approve tokenB
      await tokenB.approve(swapRouter.address, amountIn);

      //Swap TokenB => TokenA
      const params: ExactInputSingleParamsStruct = {
        tokenIn: tokenB.address,
        tokenOut: tokenA.address,
        fee: feeAB,
        recipient: owner.address,
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      };
      await swapRouter.exactInputSingle(params);

      //Check if price changed
      const priceAfter = await getPrice(tokenA, tokenB, feeAB, quoter);
      expect(priceAfter).to.be.gte(toWei(101));
    });

    it("Should return true for checkUpKeep", async () => {
      const res = await limiswap.connect(macrochain.zero).callStatic.checkUpkeep("0x");

      const upkeepNeeded = res[0];
      expect(upkeepNeeded).to.eq(true);

      if (upkeepNeeded) {
        const index = ethers.utils.defaultAbiCoder.decode(["uint"], res[1]);
        expect(index).to.eql(toBNArray([1]));
      }
    });

    it("Performs upkeep", async () => {
      const price = toWei(101);
      const amountIn = toWei(1.2);
      const [, performData] = await limiswap.connect(macrochain.zero).callStatic.checkUpkeep("0x");

      //Perform UpKeep
      await limiswap.connect(keeper).performUpkeep(performData);

      //The order shouldn't exist
      await expect(limiswap.getOrder(1)).to.be.revertedWith("Query for nonexistent order");
      //Check if user got tokenB
      await expect(await tokenB.balanceOf(alice.address)).to.be.gte(
        price.mul(amountIn).mul(9).div(10).div(tenPow18),
      );
    });
  });

  describe("Intermidate test", async () => {});
});
