@Library('shared-lib') _
pipeline {
  agent any
    environment {
        CHAT_ID = credentials('whatsapp-group')
        // CHAT_ID = "6285156803524@s.whatsapp.net"
        // Telegram Message Pre Build
        CURRENT_BUILD_NUMBER = "${currentBuild.number}"
        GIT_MESSAGE = sh(returnStdout: true, script: "git log -n 1 --format=%s ${GIT_COMMIT}").trim()
        GIT_AUTHOR = sh(returnStdout: true, script: "git log -n 1 --format=%ae ${GIT_COMMIT}").trim()
        GIT_COMMIT_SHORT = sh(returnStdout: true, script: "git rev-parse --short ${GIT_COMMIT}").trim()
        GIT_INFO = "Branch(Version): ${GIT_BRANCH}\nLast Message: ${GIT_MESSAGE}\nAuthor: ${GIT_AUTHOR}\nCommit: ${GIT_COMMIT_SHORT}"
        TEXT_BREAK = "--------------------------------------------------------------"
        TEXT_PRE_BUILD = "${TEXT_BREAK}\n${GIT_INFO}\n${JOB_NAME} -- 🤝 ${BUILD_URL}console"
        // TEXT_PRE_BUILD = "${TEXT_BREAK}\n${GIT_INFO}\n${JOB_NAME} -- Please Approved Building @b_indrawan 🤝 ${BUILD_URL}console"
        // Telegram Message Success and Failure
        TEXT_SUCCESS_BUILD = "${JOB_NAME} Build SUCCESS ✅"
        TEXT_FAILURE_BUILD = "${JOB_NAME} Build FAILURE ❌"
        TEXT_ABORTED_BUILD = "${JOB_NAME} Build ABORTED ⛔️"

        FILE_ENVIRONTMENT = '.env.example'
        IMAGE_REGISTRY_PATH = 'reg.icc.private/icc/whatsapp-api-adnan'
        MANIFEST_PATH = "whatsapp-api-adnan/statefulset.yml"

        GIT_BRANCH_TO_SWITCH = "master"
    }
    parameters {
      string(defaultValue: "adnan.khafabi@kelaspintar.id", description: 'git config user.email ', name: 'GIT_CONFIG_EMAIL')
      string(defaultValue: "Adnan Khafabi", description: 'git config user.name', name: 'GIT_CONFIG_USERNAME')
      
      // parameter of application
      string(defaultValue: "main", description: "Branch of Application", name: 'Application_Branch')
      string(defaultValue: "git.incenter.id/adnan/whatsapp-api.git", description: "url git", name: 'Url_Git')
      string(defaultValue: "main", description: "default branch", name: 'BRANCH_NAME')
    }
    options { disableConcurrentBuilds(abortPrevious: true) }
    stages {
      stage('Send Notification'){
        steps {
          sendToWhatsappGroup("${env.TEXT_PRE_BUILD}", CHAT_ID)
        }
      }
      stage('Change remote git') {
        steps {
            script {
                withCredentials([usernamePassword(credentialsId: 'adnan-auth', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                    commandSsh("git remote set-url origin https://${USERNAME}:${PASSWORD}@${Url_Git};")
                }
            }
        }
      }
      stage('Pull Repository') {
        steps {
        //   sh 'ssh arch@docker.icc.private "cd whatsapp-api; git pull origin ${Application_Branch};"'
          commandSsh("git pull origin ${Application_Branch};")
        }
      }
      stage('Deploy to server') {
        steps {
            // sh 'ssh arch@docker.icc.private "cd whatsapp-api; docker compose up -d --build;"'
            commandSsh('docker compose up -d --build;')
            // commandSsh("docker compose exec app npm run prisma:migrate")
            // commandSsh("docker compose exec app npm run prisma:generate")
        }
      }
      stage('Change to default origin') {
        steps {
            commandSsh("git remote set-url origin https://${Url_Git};")
      }
    }
      // stage('Copy-Config') {
      //   steps {
      //     sh "cp ${FILE_ENVIRONTMENT} .env"
      //     sh "echo injection X_API_KEY"
      //     // sh "sed -i 's/X_API_KEY[^ ]*$/X_API_KEY=HELLOWORLD/g' .env"
      //     sh "sed -i 's/X_API_KEY[^ ]*${'$'}/X_API_KEY=HELLOWORLD/g' .env"
      //   }
      // }
      // stage('Build Docker image') {
      //   steps {
      //     sh "docker build --no-cache -t ${IMAGE_REGISTRY_PATH}:${BUILD_NUMBER} -f Dockerfile ."
      //   }
      // }
      // stage('Docker push to Container Registry') {
      //   steps {
      //     sh "docker push ${IMAGE_REGISTRY_PATH}:${BUILD_NUMBER}"
      //   }
      // }
      // stage('Delete Docker image') {
      //   steps {
      //     sh "docker rmi -f ${IMAGE_REGISTRY_PATH}:${BUILD_NUMBER}"
      //   }
      // }
      // stage('Git Clone for the kubeconfig code') {
      //   steps {
      //     git branch: "${GIT_BRANCH_TO_SWITCH}", credentialsId: 'github', url: "https://git.incenter.id/infrastucture/kube-cat.git"
      //     sh 'ls -a'
      //     sh '[ -f ".env" ] && rm ".env"'
      //   }
      // }
      // stage('Update GIT') {
      //   steps {
      //     script {
      //       catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
      //         withCredentials([usernamePassword(credentialsId: 'adnan-auth', passwordVariable: 'git_password', usernameVariable: 'git_username')]) {
      //           sh "git config user.email '${params.GIT_CONFIG_EMAIL}' "
      //           sh "git config user.name '${params.GIT_CONFIG_USERNAME}' "
      //           sh "cat '${MANIFEST_PATH}' "
      //           sh "sed -i 's+${IMAGE_REGISTRY_PATH}:[^ ]*+${IMAGE_REGISTRY_PATH}:${env.BUILD_NUMBER}+g' ${MANIFEST_PATH}"
      //           sh "cat '${MANIFEST_PATH}' "
      //           sh "git add '${MANIFEST_PATH}' "
      //           sh "git commit -m 'Done by Jenkins Job changemanifest ${env.BUILD_NUMBER} WhatsApp-API' "
      //           sh "git push https://$git_username:'$git_password'@git.incenter.id/infrastucture/kube-cat.git HEAD:'${GIT_BRANCH_TO_SWITCH}'"
      //         }
      //       }
      //     }
      //   }
      // }
  }
    post {
      success {
        script{
          // sh "curl --location --request POST 'https://api.telegram.org/bot${TOKEN}/sendMessage' --form text='${TEXT_SUCCESS_BUILD}' --form chat_id='${CHAT_ID}'"
          sendToWhatsappGroup("${TEXT_SUCCESS_BUILD}", CHAT_ID)
        }
      }
      failure {
        script{
          // sh "curl --location --request POST 'https://api.telegram.org/bot${TOKEN}/sendMessage' --form text='${TEXT_FAILURE_BUILD}' --form chat_id='${CHAT_ID}'"
          sendToWhatsappGroup("${TEXT_FAILURE_BUILD}", CHAT_ID)
        }
      }
      aborted {
        script{
          // sh "curl --location --request POST 'https://api.telegram.org/bot${TOKEN}/sendMessage' --form text='${TEXT_ABORTED_BUILD}' --form chat_id='${CHAT_ID}'"
          sendToWhatsappGroup("${TEXT_ABORTED_BUILD}", CHAT_ID)
        }
      }
    }
}
// def commandSsh(String command) {
//   sh "ssh -o StrictHostKeyChecking=no arch@docker.icc.private \"cd whatsapp-api; ${command}\""
// }