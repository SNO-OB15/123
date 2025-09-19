const { Client, GatewayIntentBits, Partials, EmbedBuilder, InteractionType } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const giveaways = new Map();
let excludedRoleId = null;

client.once('ready', () => {
    console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;

    const { commandName, options } = interaction;

    if (commandName === 'giveaway') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'create') {
            const prize = options.getString('prize');
            const embed = new EmbedBuilder()
                .setTitle('🎉 이벤트! 🎉')
                .setDescription(`🎉 반응을 눌러 응모하세요! \nPrize: **${prize}**`)
                .setColor('Random')
                .setTimestamp();

            const giveawayMessage = await interaction.channel.send({ embeds: [embed] });
            giveawayMessage.react('🎉');

            giveaways.set(giveawayMessage.id, {
                prize: prize,
                participants: new Map(),
                messageId: giveawayMessage.id,
                channelId: interaction.channel.id,
                ended: false,
                weights: new Map(),
                pickedUser: null
            });

            await interaction.reply({ content: '이벤트가 개설되었습니다.', ephemeral: true });
        } else if (subcommand === 'end') {
            const messageId = options.getString('message_id');
            const giveaway = giveaways.get(messageId);

            if (!giveaway || giveaway.ended) {
                return interaction.reply({ content: '이 이벤트는 아직 활성화 되어있지 않거나, 존재하지 않습니다.', ephemeral: true });
            }

            const giveawayMessage = await interaction.channel.messages.fetch(giveaway.messageId);
            const reaction = giveawayMessage.reactions.cache.get('🎉');
            const users = await reaction.users.fetch();

            const weightedParticipants = [];
            for (const user of users.values()) {
                if (user.bot) continue;
                if (excludedRoleId) {
                    const member = await interaction.guild.members.fetch(user.id);
                    if (member.roles.cache.has(excludedRoleId)) {
                        continue;
                    }
                }
                const weight = giveaway.weights.get(user.id) || 1;
                for (let i = 0; i < weight; i++) {
                    weightedParticipants.push(user);
                }
            }

            if (weightedParticipants.length === 0) {
                return interaction.reply({ content: '아무도 응모하지 않았습니다.', ephemeral: true });
            }

            let winner;
            if (giveaway.pickedUser && Math.random() * 100 < giveaway.pickedUser.probability) {
                winner = await client.users.fetch(giveaway.pickedUser.id);
            } else {
                const winnerIndex = Math.floor(Math.random() * weightedParticipants.length);
                winner = weightedParticipants[winnerIndex];
            }

            giveaway.ended = true;
            giveaways.set(messageId, giveaway);

            const winnerEmbed = new EmbedBuilder()
                .setTitle('🎉 이벤트가 끝났습니다! 🎉')
                .setDescription(`당첨자: ${winner}!\nPrize: **${giveaway.prize}**`)
                .setColor('Random')
                .setTimestamp();

            await interaction.channel.send({ embeds: [winnerEmbed] });
            giveawayMessage.edit({ components: [] });
            await interaction.reply({ content: '이벤트가 끝났습니다.', ephemeral: true });

        } else if (subcommand === 'weight') {
            const messageId = options.getString('message_id');
            const user = options.getUser('user');
            const weight = options.getInteger('weight');

            const giveaway = giveaways.get(messageId);
            if (!giveaway) {
                return interaction.reply({ content: '이벤트 not found', ephemeral: true });
            }

            if (weight <= 0) {
                return interaction.reply({ content: '가중치는 양수여야 합니다.', ephemeral: true });
            }

            giveaway.weights.set(user.id, weight);
            await interaction.reply({ content: ` ${user} 에게 ${weight} 가중치를 ${messageId} 이벤트에 추가하였습니다.`, ephemeral: true });

        } else if (subcommand === 'pick') {
            const messageId = options.getString('message_id');
            const user = options.getUser('user');
            const probability = options.getInteger('probability');

            const giveaway = giveaways.get(messageId);
            if (!giveaway) {
                return interaction.reply({ content: '이벤트 not found.', ephemeral: true });
            }

            if (probability < 0 || probability > 100) {
                return interaction.reply({ content: '0과 100 사이의 수여야 합니다.', ephemeral: true });
            }

            giveaway.pickedUser = { id: user.id, probability: probability };
            await interaction.reply({ content: `User ${user} 는 ${probability}% 의 확률로 ${messageId} 이벤트에 설정되었습니다.`, ephemeral: true });
        }
    } else if (commandName === 'config') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'excluded-role') {
            const role = options.getRole('role');
            excludedRoleId = role.id;
            await interaction.reply({ content: `Excluded role ID set to ${excludedRoleId}.`, ephemeral: true });
        } else if (subcommand === 'show') {
            await interaction.reply({ content: `**Current Configuration:**\nExcluded Role ID: ${excludedRoleId || 'Not set'}`, ephemeral: true });
        }
    }
});

client.login(token);
