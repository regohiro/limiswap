import JSBI from 'jsbi'
import { CurrencyAmount, Percent, Price, Token, TradeType, BigintIsh } from "@uniswap/sdk-core";
import { computePoolAddress, FeeAmount, nearestUsableTick, Pool, Route, SwapQuoter, TickMath, TICK_SPACINGS, Trade } from "@uniswap/v3-sdk";
import { ethers } from "hardhat";
import { IUniswapV3Pool, IUniswapV3Pool__factory } from "../abis/types";
import { fromBN, MacroChain, toBN, toWei } from "../utils";

const getState = async (pool: IUniswapV3Pool) => {
  const [liquidty, slot0] = await Promise.all([pool.liquidity(), pool.slot0()]);
  return {
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    liquidity: liquidty.toString(),
    tick: slot0.tick,
  };
};

const main = async () => {
  const { zero } = await MacroChain.init();
  const tokenIn = "0x3f75B3d31a1ac8A35Ca2703B520686B90208105A";
  const tokenOut = "0x306A6C2C966EA2D3D724F079C420bCCf45c44584";
  const tokenA = new Token(42, tokenIn, 18);
  const tokenB = new Token(42, tokenOut, 18);

  try {
    const feeAmount = FeeAmount.MEDIUM;
    const poolAddr = computePoolAddress({
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      tokenA,
      tokenB,
      fee: 3000,
    });
    const { sqrtPriceX96, liquidity, tick } = await getState(IUniswapV3Pool__factory.connect(poolAddr, zero))
    console.log("1");

    const pool = new Pool(tokenA, tokenB, feeAmount, sqrtPriceX96, JSBI.BigInt(liquidity), tick, [
      {
        index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: JSBI.BigInt(liquidity),
        liquidityGross: JSBI.BigInt(liquidity)
      },
      {
        index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: JSBI.multiply(JSBI.BigInt(liquidity), JSBI.BigInt(-1)),
        liquidityGross: JSBI.BigInt(liquidity)
      }
    ]);

    console.log("2");
    
    const swapRoute = new Route([pool], tokenA, tokenB);

    console.log("3");

    const trade = await Trade.fromRoute(
      swapRoute,
      CurrencyAmount.fromRawAmount(tokenA, (10**18).toString()),
      TradeType.EXACT_INPUT
    );

    console.log("4");

    const amountOut = trade.minimumAmountOut(new Percent(0, 100));
    console.log(amountOut.toFixed(5));


    console.log("5");
    // inputAmount: CurrencyAmount.fromRawAmount(tokenA, amountIn.toString()),
    //   outputAmount: CurrencyAmount.fromRawAmount(
    //     TokenB,
    //     quotedAmountOut.toString()
    //   ),
    //   tradeType: TradeType.EXACT_INPUT,

  } catch (err) {
    throw err;
  }
};

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });
