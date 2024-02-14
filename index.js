//index.js
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const app = express();
const httpServer = createServer(app);
const games = {};
const questionsData = require('./questions.json');
const io = new Server(httpServer, {});


app.use(express.static("public"));

function findQuestionById(questionId) {
    for (let category of Object.values(questionsData)) {
        let question = category.find(q => q.id === questionId);
        if (question) {
            console.log("Question found:", question); 
            return question;
        }
    }
    console.log("Question not found for ID:", questionId); 
    return null;
}

//FUNCIONES/////////////////////////////////////////////////////

//GENERAR PIN/////////////////////////////////////////////////////

function generateGamePin() {
    let pin = "";
    while (!pin || games[pin]) {
        pin = Math.floor(1000 + Math.random() * 9000).toString(); 
    }
    return pin;
}

//PRIMERA PREGUNTA DE LA CATEGORIA/////////////////////////////////////////////////////

function getFirstQuestionFromCategory(category) {
    return questionsData[category][0]; 
}

//PASAR AUTOMATICAMENTE DE PREGUNTAS/////////////////////////////////////////////////////

function goToNextQuestion(pin) {
    const game = games[pin];
    if (!game) return; 

    if (game.currentQuestionIndex < game.config.questionQuantity) {
        const questionsInCategory = questionsData[game.config.questionCategory];

        if (game.currentQuestionIndex < questionsInCategory.length) {
            const questionObject = questionsInCategory[game.currentQuestionIndex];

            io.to(pin).emit("game starting", {
                question: questionObject,
                questionTime: game.config.questionTime,
                questionIndex: game.currentQuestionIndex
            });

            game.currentQuestionIndex++;

            setTimeout(() => {
                setTimeout(() => {
                    if (game.currentQuestionIndex < game.config.questionQuantity) {
                        goToNextQuestion(pin); 
                    } else {
                        endGame(pin); 
                    }
                }, 7000); 
            }, game.config.questionTime * 1000); 
        } else {
            endGame(pin);
        }
    } else {
        endGame(pin);
    }
}

function sendFeedbackToPlayers(pin, questionIndex) {
    const game = games[pin];
    if (!game || !game.answers) return;

    const question = questionsData[game.config.questionCategory][questionIndex];
    const correctAnswerIndex = question.answers.findIndex(answer => answer === question.correct);

    Object.entries(game.answers).forEach(([playerId, playerAnswer]) => {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
            const isCorrect = question.answers[playerAnswer.selectedAnswerIndex] === question.correct;
            playerSocket.emit("answer feedback", {
                isCorrect: isCorrect,
                correctAnswer: question.correct,
                correctAnswerIndex: correctAnswerIndex
            });
        }
    });

    game.answers = {};
}

function endGame(pin) {
    const game = games[pin];
    if (!game || !game.scores) return;

    const playerScores = game.players.map(player => {
        const scoreData = game.scores[player.nickname] || { score: 0, correct: 0, incorrect: 0 }; 
        return {
            nickname: player.nickname,
            score: scoreData.score,
            correct: scoreData.correct,
            incorrect: scoreData.incorrect
        };
    });

    const rankings = playerScores.sort((a, b) => b.score - a.score);

    const adminSocket = io.sockets.sockets.get(game.admin);
    if (adminSocket) {
        adminSocket.emit("game over admin", {
            message: "Game has ended.",
            rankings: rankings.slice(0, 3) 
        });
    }

    rankings.forEach((playerRanking, index) => {
        const playerSocket = io.sockets.sockets.get(game.players.find(p => p.nickname === playerRanking.nickname).id);
        if (playerSocket) {
            playerSocket.emit("game over player", {
                position: index + 1,
                score: playerRanking.score,
                correct: playerRanking.correct,
                incorrect: playerRanking.incorrect
            });
        }
    });

    console.log(`Game over ${pin}`);
}



//CONEXIÓN Y START GAME/////////////////////////////////////////////////////

io.on("connection", (socket) => {
    console.log('A client connected:', socket.id);
    const categories = Object.keys(questionsData);
    socket.emit("categories", categories);

    socket.on("start game", (pin) => {
        if (games[pin] && socket.id === games[pin].admin) {
            // Ensure the game's current question index is initialized
            if (typeof games[pin].currentQuestionIndex === 'undefined') {
                games[pin].currentQuestionIndex = 0; // Initialize it if not already done
            }
            goToNextQuestion(pin);
        } else {
            socket.emit("error", { message: "Game start failed: Invalid PIN or not an admin." });
        }
    });

    //CREAR PARTIDA/////////////////////////////////////////////////////

    // When creating a new game
    socket.on("create game", (config) => {
        const pin = generateGamePin(); // Ensure this function generates a unique PIN
        const questionsForGame = loadQuestionsForGame(config.questionCategory, config.questionQuantity);

        games[pin] = {
            admin: socket.id,
            config,
            questions: questionsForGame, // Use the loaded questions here
            players: [{ id: socket.id, nickname: socket.data.nickname }],
            scores: {},
            currentQuestionIndex: 0
        };

        socket.join(pin); // Join the admin to the game room
        console.log("Game created:", config);
        socket.emit("game created", { success: true, pin, config }); // Notify the admin of game creation success
    });




    //ENTRAR EN PARTIDA/////////////////////////////////////////////////////

    socket.on("join game", (pin) => {
        if (games[pin]) {
            games[pin].players.push({ id: socket.id, nickname: socket.data.nickname }); // Add player to the game
            socket.join(pin); // Join the player to the game room
            io.to(pin).emit("update player list", games[pin].players); // Notify all in the room of the new player list
            socket.emit("joined game", { success: true, pin }); // Notify the joining player of success
        } else {
            socket.emit("joined game", { success: false, reason: "Invalid PIN" }); // Notify of failed attempt
        }
    });

    //NICKNAME/////////////////////////////////////////////////////

    socket.on("nickname", function (data) {
        console.log('Usuario con el nickname:', data.nickname)

        socket.data.nickname = data.nickname
        socket.data.errors = 0;

        // respondre al que ha enviat
        socket.emit("nickname rebut", { "response": "ok" })

        // respondre a la resta de clients menys el que ha enviat
        // socket.broadcast.emit(/* ... */);

        // Totes les funcions disponibles les tenim a
        //  https://socket.io/docs/v4/emit-cheatsheet/
    })

    //SELECCIONAR RESPUESTA/////////////////////////////////////////////////////
    function loadQuestionsForGame(category, quantity) {
        const questionsInCategory = questionsData[category] || [];
        const shuffledQuestions = shuffleArray(questionsInCategory);
        return shuffledQuestions.slice(0, quantity);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
        return array;
    }

    // This is a simplified example. Adjust according to your actual scoring logic.
    function updateAndEmitScore(socket, gameId, isCorrect) {
        const game = games[gameId];
        const playerScore = game.scores[socket.id] || { correct: 0, incorrect: 0, points: 0 };

        if (isCorrect) {
            playerScore.correct++;
            playerScore.points += 100; // Example points increment
        } else {
            playerScore.incorrect++;
        }

        const totalAnswers = playerScore.correct + playerScore.incorrect;
        playerScore.successPercentage = totalAnswers > 0 ? Math.round((playerScore.correct / totalAnswers) * 100) : 0;

        game.scores[socket.id] = playerScore;

        // Emit the updated score to the player
        socket.emit("score update", playerScore);
    }


    socket.on("answer selected", function (data) {
        let { pin, questionId, selectedAnswerIndex, answerTime } = data; // Assuming answerTime is sent from client

        if (!pin) {
            console.log("Pin not provided.");
            return;
        }

        const game = games[pin];
        if (!game) {
            console.log("Game not found for pin:", pin);
            return;
        }

        questionId = parseInt(questionId);
        if (isNaN(questionId) || questionId < 0 || questionId >= game.questions.length) {
            console.log("Invalid questionId:", questionId);
            return;
        }

        const question = game.questions[questionId];
        const isCorrect = selectedAnswerIndex === (question.correct - 1); // Adjust if your 'correct' is 1-based

        console.log(`Question ID: ${questionId}, Selected Answer Index: ${selectedAnswerIndex}, Correct Answer Index: ${question.correct - 1}, Is Correct: ${isCorrect}`);

        const nicknameUser = socket.data.nickname;
        if (!game.scores[nicknameUser]) {
            game.scores[nicknameUser] = { score: 0, correct: 0, incorrect: 0 };
        }

        // Time-based scoring logic
        if (isCorrect) {
            // Calculate score based on response time
            let timeScore = calculateTimeScore(answerTime, game.config.questionTime);
            game.scores[nicknameUser].score += timeScore;
            game.scores[nicknameUser].correct++;
        } else {
            game.scores[nicknameUser].incorrect++;
        }

        socket.emit("score update", { nickname: nicknameUser, ...game.scores[nicknameUser] });

        socket.emit("answer feedback", {
            isCorrect: isCorrect,
            correctAnswerIndex: question.correct, // Adjust if 'correct' is 1-based
            correctAnswer: question.answers[question.correct], // Optionally send the correct answer text for display
        });
    });

    function calculateTimeScore(answerTime, maxTime) {
        // Placeholder for your scoring algorithm, e.g., max 100 points, linear decrease
        let timeLeft = maxTime - answerTime;
        let timeScore = Math.max(0, timeLeft * 10); // Example: 10 points per second left
        return timeScore;
    }

    
    




});

//SERVIDOR/////////////////////////////////////////////////////

httpServer.listen(3000, () =>
    console.log(`Server listening at http://localhost:3000`)
);