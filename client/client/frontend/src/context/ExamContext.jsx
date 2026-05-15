import React, {

  createContext,
  useState

} from "react";

export const ExamContext =
createContext();

function ExamProvider({ children }) {

  const [answers, setAnswers] =
  useState({});

  return (

    <ExamContext.Provider
      value={{
        answers,
        setAnswers
      }}
    >

      {children}

    </ExamContext.Provider>

  );

}

export default ExamProvider;