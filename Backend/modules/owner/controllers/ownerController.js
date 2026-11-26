import usersRouter, { getUsersHandlerChain } from './usersController.js';
import reportsRouter, { getReportsHandlerChain } from './reportsController.js';

export const ownerSubrouters = { usersRouter, reportsRouter };
export const ownerHandlers = { getUsersHandlerChain, getReportsHandlerChain };
