import menuRouter, { getMenuHandlerChain } from './menuController.js';
import usersRouter, { getUsersHandlerChain } from './usersController.js';
import reportsRouter, { getReportsHandlerChain } from './reportsController.js';

export const ownerSubrouters = { menuRouter, usersRouter, reportsRouter };
export const ownerHandlers = { getMenuHandlerChain, getUsersHandlerChain, getReportsHandlerChain };
