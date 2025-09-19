const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId, guildId } = require('./config.json');

const commands = [
    {
        name: 'giveaway',
        description: 'Giveaway commands',
        options: [
            {
                name: 'create',
                description: 'Create a new giveaway',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'prize',
                        description: 'The prize of the giveaway',
                        type: 3, // STRING
                        required: true,
                    },
                ],
            },
            {
                name: 'end',
                description: 'End an active giveaway',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'message_id',
                        description: 'The message ID of the giveaway to end',
                        type: 3, // STRING
                        required: true,
                    },
                ],
            },
            {
                name: 'weight',
                description: 'Set a weight for a user in a giveaway',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'message_id',
                        description: 'The message ID of the giveaway',
                        type: 3, // STRING
                        required: true,
                    },
                    {
                        name: 'user',
                        description: 'The user to set the weight for',
                        type: 6, // USER
                        required: true,
                    },
                    {
                        name: 'weight',
                        description: 'The weight to set for the user',
                        type: 4, // INTEGER
                        required: true,
                    },
                ],
            },
            {
                name: 'pick',
                description: 'Pick a user to have a higher chance of winning',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'message_id',
                        description: 'The message ID of the giveaway',
                        type: 3, // STRING
                        required: true,
                    },
                    {
                        name: 'user',
                        description: 'The user to pick',
                        type: 6, // USER
                        required: true,
                    },
                    {
                        name: 'probability',
                        description: 'The probability of the user winning (0-100)',
                        type: 4, // INTEGER
                        required: true,
                    },
                ],
            },
        ],
    },
    {
        name: 'config',
        description: 'Configuration commands',
        options: [
            {
                name: 'excluded-role',
                description: 'Set the role to be excluded from giveaways',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'role',
                        description: 'The role to exclude',
                        type: 8, // ROLE
                        required: true,
                    },
                ],
            },
            {
                name: 'show',
                description: 'Show the current configuration',
                type: 1, // SUB_COMMAND
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
