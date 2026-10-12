import * as userService from '../services/user.service.js';

export async function listUsers(req, res) {
  const users = await userService.listUsers(req.validated.query);
  res.status(200).json({ users });
}
