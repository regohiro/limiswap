import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "hardhat-deploy-ethers/dist/src/signers";
import { fromBNArray, fromWei, MacroChain, tenPow18, toBN, toBNArray, toWei } from "../utils";
import {
  IERC20,
  IERC20__factory,
  ISwapRouter,
  ISwapRouter__factory,
  LimiSwap,
  LimiSwap__factory,
  IQuoter__factory,
  IQuoter,
} from "../typechain";
import { ExactInputSingleParamsStruct } from "../typechain/ISwapRouter";
import { IUniswapV3Pool, IUniswapV3Pool__factory } from "../abis/types";
import { Token } from "@uniswap/sdk-core";
import { getPoolImmutables, getPrice } from "./utils";

chai.use(solidity);
const { expect } = chai;

let macrochain: MacroChain;

let poolAB: IUniswapV3Pool;
let limiswap: LimiSwap;
let swapRouter: ISwapRouter;
let quoter: IQuoter;

let tokenA: IERC20;
let tokenB: IERC20;

let TokenA: Token;
let TokenB: Token;

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
    const { deployer } = macrochain;

    //Deploy LimiSwap
    const routerAddr = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    const quoterAddr = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
    limiswap = await deployer<LimiSwap__factory>("LimiSwap", [keeper.address, routerAddr, quoterAddr]);

    //Connect to Router & Quoter
    swapRouter = ISwapRouter__factory.connect(routerAddr, owner);
    quoter = IQuoter__factory.connect(quoterAddr, owner);

    //Connect to TokenA-TokenB pool contract
    const poolAddr = "0xC966A59D1087D1d1B4C15FAb5F5ddfAB31b47bF9";
    poolAB = IUniswapV3Pool__factory.connect(poolAddr, owner);

    //Get constants
    const { token0, token1, fee } = await getPoolImmutables(poolAB);
    TokenA = new Token(42, token1, 18);
    TokenB = new Token(42, token0, 18);
    feeAB = fee;

    //Connect to token contracts
    tokenA = IERC20__factory.connect(TokenA.address, owner);
    tokenB = IERC20__factory.connect(TokenB.address, owner);

    await tokenA.approve(swapRouter.address, ethers.constants.MaxUint256);
    await tokenB.approve(swapRouter.address, ethers.constants.MaxUint256);
  });

  describe("Basic test", () => {
    // Right now, A : B = 1 : 98.87
    it("Creates order", async () => {
      const price = toWei(100);
      const amountIn = toWei(1.2);
      const tokenIn = tokenA.address;
      const tokenOut = tokenB.address;
      const slippage = 10000;

      await tokenA.approve(limiswap.address, amountIn);
      //Creates A => B limit order of when A : B = 1 : 100
      await limiswap.createOrder(price, amountIn, tokenIn, tokenOut, feeAB, slippage);

      await expect(limiswap.getOrder(1)).not.to.reverted;
    });

    it("Changes the price of A-B so that it meets the price target", async () => {
      const amountIn = toWei(100);
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
      expect(priceAfter).to.be.gte(toWei(100));
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
      const price = toWei(100);
      const amountIn = toWei(1.2);
      const [, performData] = await limiswap.connect(macrochain.zero).callStatic.checkUpkeep("0x");
      const tokenB_balanceBefore = await tokenB.balanceOf(owner.address);

      await limiswap.connect(keeper).performUpkeep(performData);

      const tokenB_balanceAfter = await tokenB.balanceOf(owner.address);

      await expect(limiswap.getOrder(1)).to.be.revertedWith("Query for nonexistent order");
      await expect(tokenB_balanceAfter.sub(tokenB_balanceBefore)).to.be.gte(
        price.mul(amountIn).mul(9).div(10).div(tenPow18),
      );
    });
  });
});
