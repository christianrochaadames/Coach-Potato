import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entriesRouter from "./entries";
import statsRouter from "./stats";
import yearsRouter from "./years";
import tmdbRouter from "./tmdb";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entriesRouter);
router.use(statsRouter);
router.use(yearsRouter);
router.use(tmdbRouter);

export default router;
