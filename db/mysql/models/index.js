const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const basename = path.basename(__filename);

const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config.js")[env];

/** Object containing the database models */
const db = {};

// Initialize sequelize instance
const Op = Sequelize.Op;
const operatorsAliases = {
  $or: Op.or,
  $and: Op.and,
  $like: Op.like,
};
config.operatorsAliases = operatorsAliases;
let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Add each model in the models directory to the database object as property
fs.readdirSync(__dirname)
  .filter((file) => {
    return file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js";
  })
  .forEach((file) => {
    const model = sequelize["import"](path.join(__dirname, file));
    db[model.name] = model;
  });

// Create model associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

/**
  * Automatically create the tables according to the model definitions
  * Returns the database connection
  */
const connect = () => {
  return new Promise(function(resolve, reject) {
    sequelize
      .sync()
      .then(() => {
        winstonLogger.info("Database connected");
        return resolve(db);
      })
      .catch((err) => {
        winstonLogger.error(`Unable to connect to database: ${JSON.stringify(err)}`);
        return reject(err);
      });
  });
};

/** Close connection to database */
const disconnect = () => {
  return new Promise(function(resolve) {
    winstonLogger.info("Database disconnected");
    resolve(sequelize.close());
  });
};

const clean = () => {
  return new Promise(function(resolve) {
    sequelize.sync({ force: true }).then(() => {
      resolve(true);
    });
  });
};

module.exports = {
  disconnect,
  connect,
  clean,
  db,
};
