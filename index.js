const JobsService = require('./services/jobs.service');

const jobsService = new JobsService();

const dailyJob = jobsService.dailyJob();
const hostJob = jobsService.hostJob();
const closeTasksJob = jobsService.closeTasks();
const deleteOldVacationsJob = jobsService.deleteOldVacations();
const youAreHost = jobsService.youAreHost();

dailyJob.start();
hostJob.start();
closeTasksJob.start();
deleteOldVacationsJob.start();
youAreHost.start();
