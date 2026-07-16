import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { requireAuth } from "./auth";
import publicRouter from "./public";
import propertiesRouter from "./properties";
import peopleRouter from "./people";
import leadsRouter from "./leads";
import opsRouter from "./ops";
import adminRouter from "./admin";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
// Public routes — no auth required
router.use(publicRouter);
// All business routes below require a logged-in user.
router.use(requireAuth);
router.use(propertiesRouter);
router.use(peopleRouter);
router.use(leadsRouter);
router.use(opsRouter);
router.use(adminRouter);
router.use(dashboardRouter);

export default router;
