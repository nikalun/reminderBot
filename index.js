const JobsService = require('./services/jobs.service');

const jobsService = new JobsService();

const dailyJob = jobsService.dailyJob();
const hostJob = jobsService.hostJob();
const closeTasksJob = jobsService.closeTasks();
const closeTasksSecond = jobsService.closeTasksSecond();
const deleteOldVacationsJob = jobsService.deleteOldVacations();
const youAreHost = jobsService.youAreHost();
const chooseNewBotName = jobsService.chooseNewBotName();

dailyJob.start();
hostJob.start();
closeTasksJob.start();
closeTasksSecond.start();
deleteOldVacationsJob.start();
youAreHost.start();
chooseNewBotName.start();
