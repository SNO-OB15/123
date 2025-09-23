const { REST, Routes } = require('discord.js');
const { token, clientId, guildId } = require('./config.json');

const commands = [
  {
    name: 'giveaway',
    description: '이벤트 관리',
    options: [
      {
        type: 1,
        name: 'create',
        description: '새 이벤트를 생성합니다.',
        options: [
          { type: 3, name: 'prize', description: '상품명', required: true },
          { type: 3, name: 'name', description: '이벤트 이름', required: false },
        ],
      },
      {
        type: 1,
        name: 'end',
        description: '이벤트를 종료합니다.',
        options: [
          { type: 3, name: 'message_id', description: '이벤트 메시지 ID', required: true }
        ]
      },
      {
        type: 1,
        name: 'weight',
        description: '특정 유저의 가중치를 설정합니다.',
        options: [
          { type: 6, name: 'user', description: '대상 유저', required: true },
          { type: 4, name: 'weight', description: '가중치 값 (기본 1)', required: true }
        ]
      },
      {
        type: 1,
        name: 'pick',
        description: '특정 유저를 픽으로 설정합니다.',
        options: [
          { type: 6, name: 'user', description: '대상 유저', required: true },
          { type: 10, name: 'probability', description: '픽 확률 (0~100%)', required: true }
        ]
      },
    ],
  },
  {
    name: 'config',
    description: '봇 설정 관리',
    options: [
      {
        type: 1,
        name: 'exclude-role-add',
        description: '참여를 제외할 역할을 추가합니다.',
        options: [{ type: 8, name: 'role', description: '제외할 역할', required: true }],
      },
      {
        type: 1,
        name: 'exclude-role-remove',
        description: '참여 제외 목록에서 역할을 제거합니다.',
        options: [{ type: 8, name: 'role', description: '제거할 역할', required: true }],
      },
      {
        type: 1,
        name: 'list-excluded',
        description: '참여 제외된 역할 목록 보기',
      },
      {
        type: 1,
        name: 'add-role',
        description: '명령어 사용을 허용할 역할 추가',
        options: [{ type: 8, name: 'role', description: '허용할 역할', required: true }],
      },
      {
        type: 1,
        name: 'remove-role',
        description: '명령어 사용 허용에서 역할 제거',
        options: [{ type: 8, name: 'role', description: '제거할 역할', required: true }],
      },
      {
        type: 1,
        name: 'list-roles',
        description: '현재 허용된 역할 목록 보기',
      }
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
