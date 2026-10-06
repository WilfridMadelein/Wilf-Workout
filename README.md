cd "D:\Projet codage\App - Workout"
git add -A
git commit -m "Prevent stale HTML fragments after updates"
git push
npm run sync:android
cd .\android
.\gradlew.bat assembleDebug