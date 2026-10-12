import * as taskService from '../services/task.service.js';

// Identity always comes from req.user (set by requireAuth), never from the request body.

export async function createTask(req, res) {
  const task = await taskService.createTask(req.user, req.validated.body);
  res.status(201).json({ task });
}

export async function listTasks(req, res) {
  const { tasks, pagination } = await taskService.listTasks(req.user, req.validated.query);
  res.status(200).json({ tasks, pagination });
}

export async function getTask(req, res) {
  const task = await taskService.getTask(req.user, req.validated.params.id);
  res.status(200).json({ task });
}

export async function updateTask(req, res) {
  const task = await taskService.updateTask(req.user, req.validated.params.id, req.validated.body);
  res.status(200).json({ task });
}

export async function deleteTask(req, res) {
  await taskService.deleteTask(req.user, req.validated.params.id);
  res.status(204).end();
}

export async function getTaskStats(req, res) {
  const stats = await taskService.getTaskStats(req.user);
  res.status(200).json({ stats });
}
