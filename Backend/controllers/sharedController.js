import dashboardRouter, { getDashboardHandlerChain } from './dashboardController.js';
import notificationsRouter, { getNotificationsHandlerChain } from './notificationsController.js';

// Dashboard and notification logic stays role-aware and shared by all roles.
export const sharedSubrouters = { dashboardRouter, notificationsRouter };
export const sharedHandlers = { getDashboardHandlerChain, getNotificationsHandlerChain };
