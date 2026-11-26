// Shared aggregation for role-specific dashboard and notification endpoints.
// [WBS 1.3.1, 2.3.1, 3.3.1, 4.1.1, 4.1.2] Keep cross-role handlers mounted once.
import dashboardRouter, { getDashboardHandlerChain } from './dashboardController.js';
import notificationsRouter, { getNotificationsHandlerChain } from './notificationsController.js';

// Dashboard and notification logic stays role-aware and shared by all roles.
export const sharedSubrouters = { dashboardRouter, notificationsRouter };
export const sharedHandlers = { getDashboardHandlerChain, getNotificationsHandlerChain };
