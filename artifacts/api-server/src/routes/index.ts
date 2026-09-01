import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { requireAuth } from "./auth";
import publicRouter from "./public";
import propertiesRouter from "./properties";
import peopleRouter from "./people";
import leadsRouter from "./leads";
import opsRouter from "./ops";
import adminRouter from "./admin";
import adminPortalRouter from "./admin-portal";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import collaborationRouter from "./collaboration";
import multiAgentRouter from "./multi-agent";
import housekeepingRouter from "./housekeeping";
import importsRouter from "./imports";
import reviewsRouter from "./reviews";
import rentalProfileRouter from "./rental-profile";
import propertyAlertsRouter from "./property-alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
// Storage reads are public for published listing media, while upload URL
// requests validate the bearer session inside the route.
router.use(storageRouter);
// Public routes — no auth required
router.use(publicRouter);
router.use(rentalProfileRouter);
router.use(propertyAlertsRouter);
router.use(reviewsRouter);
// All business routes below require a logged-in user.
router.use(requireAuth);
router.use(multiAgentRouter);
router.use(housekeepingRouter);
router.use(importsRouter);
router.use(propertiesRouter);
router.use(collaborationRouter);
router.use(peopleRouter);
router.use(leadsRouter);
router.use(opsRouter);
router.use(adminRouter);
router.use(adminPortalRouter);
router.use(dashboardRouter);

export default router;
