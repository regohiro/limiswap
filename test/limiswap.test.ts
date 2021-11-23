import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "hardhat-deploy-ethers/dist/src/signers";
import { fromBN, MacroChain, tenPow18, toBN, toBNArray, toWei } from "../utils";
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
import { INonfungiblePositionManager, INonfungiblePositionManager__factory } from "../abis/types";
import { getPrice } from "./utils";
import { MintParamsStruct } from "../abis/types/INonfungiblePositionManager";

chai.use(solidity);
const { expect } = chai;
const {
  utils: { defaultAbiCoder },
} = ethers;

let macrochain: MacroChain;
let owner: SignerWithAddress;
let keeper: SignerWithAddress;
let alice: SignerWithAddress;

let swapRouter: ISwapRouter;
let quoter: IQuoter;
let positionManager: INonfungiblePositionManager;
let limiswap: LimiSwap;

let tokenA: IERC20;
let tokenB: IERC20;
let feeAB: number;

describe("LimiSwap contract test", () => {
  before(async () => {
    //Initiate MacroChain and accounts
    macrochain = await MacroChain.init();
    const { users } = macrochain;
    owner = users[0];
    keeper = users[1];
    alice = users[2];
  });

  const init = async () => {
    //Connect to Router & Quoter
    {
      const routerAddr = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
      const quoterAddr = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
      const nonfungiblePositionManagerAddr = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
      swapRouter = ISwapRouter__factory.connect(routerAddr, owner);
      quoter = IQuoter__factory.connect(quoterAddr, owner);
      positionManager = INonfungiblePositionManager__factory.connect(nonfungiblePositionManagerAddr, owner);
    }

    //Deploy contracts
    {
      const { deployer } = macrochain;
      //Deploy LimiSwap
      const wethAddr = "0xd0a1e359811322d97991e03f863a0c30c2cf029c";
      limiswap = await deployer<LimiSwap__factory>("LimiSwap", [keeper.address, swapRouter.address, quoter.address, wethAddr]);

      //Deploy tokens
      const supply = toWei(1_000_000);
      const token0 = await deployer<MockERC20__factory>("MockERC20", ["0", "0", supply]);
      const token1 = await deployer<MockERC20__factory>("MockERC20", ["1", "1", supply]);
      if(token0.address < token1.address){
        tokenA = token0;
        tokenB = token1;
      }else{
        tokenB = token0;
        tokenA = token1;
      } 
    }

    //Approve tokens
    {
      await tokenA.approve(swapRouter.address, ethers.constants.MaxUint256);
      await tokenA.approve(positionManager.address, ethers.constants.MaxUint256);
      await tokenB.approve(swapRouter.address, ethers.constants.MaxUint256);
      await tokenB.approve(positionManager.address, ethers.constants.MaxUint256);
    }

    //Initialize A/B pool and set to A : B = 1 : 99.4
    {
      feeAB = 3000;
      const sqrtPriceX96 = "792281450588003167884250659085";
      await positionManager.createAndInitializePoolIfNecessary(tokenA.address, tokenB.address, feeAB, sqrtPriceX96);
    }

    //Provide liquidity
    {
      const deadline = (await limiswap.getTime()) + 10;
      const MIN_TICK = 39120;
      const MAX_TICK = 52980;
      const amount0 = "100000000000000000000";
      const amount1 = "10009659626893481476006";

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
      };
      await positionManager.mint(params);
    }
  };

  describe("Basic test", () => {
    before(async () => {
      await init();
      await tokenA.transfer(alice.address, toWei(10));
    });

    it("Prints price", async () => {
      const price = await getPrice(tokenA, tokenB, feeAB, quoter);
      expect(price).to.be.gt(0);
      // console.log(fromBN(price));
    });

    //Current: A/B = 99.4
    it("Creates A => B limit order of when A/B = 100", async () => {
      const price = toWei(100);
      const amountIn = toWei(1.5);
      const tokenIn = tokenA.address;
      const tokenOut = tokenB.address;
      const slippage = 10000; //MAX

      await tokenA.connect(alice).approve(limiswap.address, amountIn);
      await limiswap.connect(alice).createOrder(price, amountIn, tokenIn, tokenOut, feeAB, slippage);

      await expect(limiswap.getOrder(1)).not.to.be.reverted;
    });

    it("Changes the price of A/B so that it meets the price target", async () => {
      const amountIn = toWei(150);
      const deadline = (await limiswap.getTime()) + 100;

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
        const index = defaultAbiCoder.decode(["uint"], res[1]);
        expect(index).to.eql(toBNArray([1]));
      }
    });

    it("Performs upkeep", async () => {
      const price = toWei(100);
      const amountIn = toWei(1.5);
      const [, performData] = await limiswap.connect(macrochain.zero).callStatic.checkUpkeep("0x");

      //Perform UpKeep
      await limiswap.connect(keeper).performUpkeep(performData);

      //The order shouldn't exist
      await expect(limiswap.getOrder(1)).to.be.revertedWith("Query for nonexistent order");
      //Check if user has received at least 90%
      await expect(await tokenB.balanceOf(alice.address)).to.be.gte(price.mul(amountIn).mul(9).div(10).div(tenPow18));
    });
  });

  describe("Intermidate test", async () => {
    before(async () => {
      await init();
      await tokenA.transfer(alice.address, toWei(10));
    });

    it("Creates A => B limit order of when A/B = 100", async () => {
      const price = toWei(100);
      const amountIn = toWei(5);
      const tokenIn = tokenA.address;
      const tokenOut = tokenB.address;
      const slippage = 5; //0.05% slippage

      await tokenA.connect(alice).approve(limiswap.address, amountIn);
      await limiswap.connect(alice).createOrder(price, amountIn, tokenIn, tokenOut, feeAB, slippage);
    });

    it("Should throw if perform upkeep was executed if target didn't reach", async () => {
      const preformData = defaultAbiCoder.encode(["uint"], [1]);
      const promi = limiswap.connect(keeper).performUpkeep(preformData);
      await expect(promi).to.be.revertedWith("Target not reached");
    });

    it("Prints price", async () => {
      const price = await getPrice(tokenA, tokenB, feeAB, quoter);
      expect(price).to.be.gt(0);
      // console.log(fromBN(price));
    });

    it("Changes the price of A/B so that it meets the price target", async () => {
      const amountIn = toWei(150);
      const deadline = (await limiswap.getTime()) + 100;

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

    it("Should only be performed by the keeper", async () => {
      const [upkeepNeeded, performData] = await limiswap.connect(macrochain.zero).callStatic.checkUpkeep("0x");

      expect(upkeepNeeded).to.be.true;

      const promi = limiswap.connect(owner).performUpkeep(performData);
      await expect(promi).to.be.revertedWith("Invalid access");
    });

    it("Should throw due to low slippage", async () => {
      const [, performData] = await limiswap.connect(macrochain.zero).callStatic.checkUpkeep("0x");
      const promi2 = limiswap.connect(keeper).performUpkeep(performData);

      await expect(promi2).to.be.reverted;
    });
  });

  describe("Stress test", () => {
    before(async () => {
      await init();
      await tokenA.transfer(alice.address, toWei(200));
      await tokenB.transfer(alice.address, toWei(20000));
      await tokenA.connect(alice).approve(limiswap.address, ethers.constants.MaxUint256);
      await tokenB.connect(alice).approve(limiswap.address, ethers.constants.MaxUint256);
    });

    it("Creates 100 limit orders", async () => {
      for(let i = 0; i < 100; i++){
        const price = toWei(100 + i);
        const amountIn = toWei(1.1);
        const tokenIn = tokenA.address;
        const tokenOut = tokenB.address;
        const slippage = 100; //1% slippage

        await limiswap.connect(alice).createOrder(price, amountIn, tokenIn, tokenOut, feeAB, slippage);
      }
    });

    it("Should only allow the owner to cancel orders", async () => {
      const promi1 = limiswap.connect(keeper).cancelOrder(1);
      await expect(promi1).to.be.revertedWith("Invalid access");

      const promi2 = limiswap.connect(alice).cancelOrder(101);
      await expect(promi2).to.be.revertedWith("Order does not exist");

      const tokenA_balanceBefore = await tokenA.balanceOf(alice.address);

      const promi3 = limiswap.connect(alice).cancelOrder(58);
      await expect(promi3).not.to.be.reverted;

      const tokenA_balanceAfter = await tokenA.balanceOf(alice.address);

      expect(tokenA_balanceAfter.sub(tokenA_balanceBefore)).to.eq(toWei(1.1));

      await expect(limiswap.getOrder(58)).to.be.revertedWith("Query for nonexistent order");
    });

    it("Cancels order 99", async () => {
      await limiswap.connect(alice).cancelOrder(99);
      await expect(limiswap.getOrder(99)).to.be.revertedWith("Query for nonexistent order");
    })

    it("Cancels order 100", async () => {
      await limiswap.connect(alice).cancelOrder(100);
      await expect(limiswap.getOrder(100)).to.be.revertedWith("Query for nonexistent order");
    })
  });
});
