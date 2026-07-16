const generateOptionIds = (questionId, count) => {
    // console.log(questionId)
  const number = questionId.replace("QU", "");

  return Array.from({ length: count }, (_, index) =>
    `OP${number}${index + 1}`
  );
};

module.exports = generateOptionIds;