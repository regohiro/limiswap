import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";

export async function advanceBlock(): Promise<any> {
  return ethers.provider.send("evm_mine", []);
}

export async function advanceBlockTo(blockNumber: number): Promise<void> {
  let now = (await ethers.provider.getBlockNumber()).toString();
  for (let i = parseInt(now); i < blockNumber; i++) {
    await advanceBlock();
  }
}

export async function advanceBlockBy(blockAmount: number): Promise<void> {
  for (let i = 0; i < blockAmount; i++) {
    await advanceBlock();
  }
}

export async function advanceTime(time: number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [time]);
}

export async function advanceTimeAndBlock(time: number): Promise<void> {
  await advanceTime(time);
  await advanceBlock();
}

export async function latest(): Promise<BigNumber> {
  const block = await ethers.provider.getBlock("latest");
  return BigNumber.from(block.timestamp);
}

export function toUnix(strDate: string): number {
  const datum = Date.parse(strDate);
  return datum / 1000;
}

export function getCurrentTime(addTime = 0): number {
  const time = Math.floor(Date.now() / 1000) + addTime;
  return time;
}

export const delay = (ms: number): Promise<PromiseConstructor> => new Promise(resolve => setTimeout(resolve, ms));
