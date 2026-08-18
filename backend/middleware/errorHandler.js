function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера', details: err.message });
}

module.exports = errorHandler;
