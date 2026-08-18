// Заглушка модели пользователя. В MVP хакатона мультипользовательский режим
// не обязателен, но структура заложена для дальнейшего расширения.

function createUser({ name, householdSize = 1, type = 'household' }) {
  // type: 'household' | 'school' | 'business'
  return {
    id: `user_${Date.now()}`,
    name,
    householdSize,
    type,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { createUser };
