import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entriesRouter from "./entries";
import statsRouter from "./stats";
import yearsRouter from "./years";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entriesRouter);
router.use(statsRouter);
router.use(yearsRouter);

export default router;
