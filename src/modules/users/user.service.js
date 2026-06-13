import * as userRepo from "./user.repository.js";

export async function getAllUsers() {
  return userRepo.findAll();
}

export async function getUserById(id) {
  const user = await userRepo.findById(id);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  return user;
}

export async function updateUser(id, data) {
  const user = await userRepo.findById(id);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  return userRepo.updateById(id, data);
}

export async function deleteUser(id) {
  const user = await userRepo.findById(id);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  await userRepo.deleteById(id);
}
