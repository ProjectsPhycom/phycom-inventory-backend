const AuthenticationService = require("../authentication/authentication-service");
const SessionsController = require("../sessions/sessions-controller");
const MysqlService = require("../database/mysql-service");

/**
 * @param {object} payloadData
 * @param {string} payloadData.name
 * @param {string} payloadData.lastName
 * @param {string} payloadData.email
 * @param {string} payloadData.password Hashed password
 * @param {string} payloadData.status
 * @param {string} payloadData.identification
 * @param {object} userData Data from the user who is making the request
 * @param {number} userData.id
 */
async function register(payloadData, userData) {
  // Validations
  const query = { email: payloadData.email };
  const userExists = await MysqlService.getFirstMatch("User", query);
  if (userExists) {
    return Promise.reject({
      status: 400,
      message: global.messages.USER_ALREADY_EXISTS,
    });
  }
  // Hash password before saving to database
  payloadData.password = AuthenticationService.hashPassword(payloadData.password);
  payloadData.registered_by = userData.id;
 
  // Find user's role
  const roleQuery = { name: payloadData.role };
  const role = await MysqlService.getFirstMatch("Role", roleQuery, null);
  if (!role) {
    return Promise.reject({ status: 400, message: "Role does not exist" });
  }
 
  // Create user in the database
  const user = await MysqlService.createData("User", payloadData);
 
  // Add user's role
  role.addUser(user);

  return user;
}

/**
 * @param {object} payloadData
 * @param {string} payloadData.email
 * @param {string} payloadData.password
 */
async function login(payloadData) {
  // Find user
  const query = { email: payloadData.email };
  const user = await MysqlService.getFirstMatch("User", query);
  if (!user) {
    return Promise.reject({
      status: 404,
      message: global.messages.USER_NOT_FOUND,
    });
  }
  const data = user.get({ plain: true });
  const result = await AuthenticationService.comparePassword(user.password, payloadData.password);
  if (!result) {
    return Promise.reject({
      status: 400,
      message: global.messages.INCORRECT_PASSWORD,
    });
  }
  // Create session
  const sessionData = {
    ip: payloadData.ip,
    userID: user.id,
    user,
  };
  let session = await SessionsController.sessionManager(sessionData);
  session = session.get({ plain: true });
  // Create token
  const token = AuthenticationService.createToken(user.id, user.email, data.roleId, session.id);
  // Parse data
  data.token = token;
  delete data.password;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.registered_by;

  return data;
}

/**
 * Deletes the user's session
 * @param {object} userData
 * @param {number} userData.sessionID
 */
async function logout(userData) {
  await SessionsController.expireSession(userData);
  return true;
}

/**
 * Return data from the user logged in
 * @param {object} userData
 * @param {number} userData.id
 */
async function getUserData(userData) {
  // Check if session exists
  const sessionQuery = { userID: userData.id };
  const session = await SessionsController.getSession(sessionQuery);
  if (!session) {
    return Promise.reject({
      status: 404,
      message: global.messages.SESSION_EXPIRED,
    });
  }
  // Get user details
  const userQuery = { id: userData.id };
  const userAttributes = ["name", "lastName", "email", "status"];
  const populate = { modelName: "Role", attributes: ["name"] };
  const user = await MysqlService.getFirstMatchPopulate("User", userQuery, userAttributes, populate);
  if (!user) {
    return Promise.reject({
      status: 404,
      message: global.messages.USER_NOT_FOUND,
    });
  }
  // Parse user data
  return user;
}

module.exports = {
  register,
  login,
  logout,
  getUserData,
};
