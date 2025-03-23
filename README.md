# Personalized Scheduler

## Set Your OpenAI API Key
1. Create a file named `.env` in the `/backend` directory.
2. Add the following line to the `.env` file:
```
OPENAI_API_KEY=your-api-key
```
3. Replace `your-api-key` with your OpenAI API key.

Note: you can enter your OpenAI API key in the `.env.example` file and rename it to `.env`.

## Set Up the Environment
1. Install the required packages for backend by running the following command:
```
cd backend
pip install -r requirements.txt
```

## How to Run
1. Open a terminal and run the following command:
```
cd backend
uvicorn main:app --reload
```
2. Open another terminal and run the following command:
```
cd frontend
npm start
```
3. Open a web browser and go to `http://localhost:3000/`.

## Run With Docker
We have provided a `Dockerfile` and a `docker-compose.yml` file to run the application with Docker. To run the application with Docker, follow these steps:
1. Open a terminal and run the following command:
```
docker-compose up
```
2. Open a web browser and go to `http://localhost:3000/`.
