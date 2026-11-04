import { prisma } from "../prisma";
import type { CallLogger } from "./types";

export const prismaLogger: CallLogger = async (record) => {
  await prisma.modelCall.create({ data: record });
};