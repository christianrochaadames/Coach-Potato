import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entriesRouter from "./entries";
import statsRouter from "./stats";
import yearsRouter from "./years";
import tmdbRouter from "./tmdb";
import recommendationsRouter from "./recommendations";
import profileRouter from "./profile";
import facebookRouter from "./facebook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entriesRouter);
router.use(statsRouter);
router.use(yearsRouter);
router.use(tmdbRouter);
router.use(recommendationsRouter);
router.use(profileRouter);
router.use(facebookRouter);

export default router;
