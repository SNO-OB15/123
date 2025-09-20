const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId, guildId } = require('./config.json');

const commands = [
    {
        name: 'giveaway',
        description: '이벤트 명령어',
        options: [
            {
                name: 'create',
                description: '새 이벤트를 만듭니다.',
                type: 1,
                options: [
                    {
                        name: 'prize',
                        description: '이벤트의 상품',
                        type: 3,
                        required: true,
                    },
                ],
            },
            {
                name: 'end',
                description: '활성화된 이벤트를 종료합니다.',
                type: 1,
                options: [
                    {
                        name: 'message_id',
                        description: '이벤트의 메세지 id',
                        type: 3,
                        required: true,
                    },
                ],
            },
            {
                name: 'weight',
                description: '유저에게 가중치를 부여합니다.',
                type: 1,
                options: [
                    {
                        name: 'message_id',
                        description: '이벤트의 메세지 id',
                        type: 3,
                        required: true,
                    },
                    {
                        name: 'user',
                        description: '유저',
                        type: 6,
                        required: true,
                    },
                    {
                        name: 'weight',
                        description: '가중치',
                        type: 4,
                        required: true,
                    },
                ],
            },
            {
                name: 'pick',
                description: '유저를 선택해 확률을 지정합니다.',
                type: 1,
                options: [
                    {
                        name: 'message_id',
                        description: '이벤트의 메세지 id',
                        type: 3,
                        required: true,
                    },
                    {
                        name: 'user',
                        description: '유저',
                        type: 6,
                        required: true,
                    },
                    {
                        name: 'probability',
                        description: '유저가 이길 확률 (0 ~ 100)',
                        type: 4,
                        required: true,
                    },
                ],
            },
        ],
    },
    {
        name: 'config',
        description: '설정 명령어',
        options: [
            {
                name: 'excluded-role',
                description: '이벤트에 제외된 역할',
                type: 1,
                options: [
                    {
                        name: 'role',
                        description: '제외될 역할',
                        type: 8,
                        required: true,
                    },
                ],
            },
            {
                name: 'show',
                description: '현재 설정 보기',
                type: 1,
            },
        ],
    },
];

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
