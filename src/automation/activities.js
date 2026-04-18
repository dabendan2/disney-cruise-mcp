/**
 * Activities Facade
 * This file exports functionality from the refactored modular automation files.
 */

const { getReservations, getMyPlans } = require('./itinerary');
const { getAllActivityTypes, getActivityList } = require('./catalog');
const { getActivityDetails, addActivity } = require('./booking');

module.exports = {
    getReservations,
    getMyPlans,
    getAllActivityTypes,
    getActivityList,
    getActivityDetails,
    addActivity
};
