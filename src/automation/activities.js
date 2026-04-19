/**
 * Activities Facade
 * This file exports functionality from the refactored modular automation files.
 */

const { getReservations, getMyPlans } = require('./itinerary');
const { getBookableActivityTypes, getActivityList } = require('./catalog');
const { getActivityDetails, addActivity } = require('./booking');

module.exports = {
    getReservations,
    getMyPlans,
    getBookableActivityTypes,
    getActivityList,
    getActivityDetails,
    addActivity
};
