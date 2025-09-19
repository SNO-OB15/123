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
                .setTitle('🎉 Giveaway! 🎉')
                .setDescription(`React with 🎉 to enter!\nPrize: **${prize}**`)
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

            await interaction.reply({ content: 'Giveaway created!', ephemeral: true });
        } else if (subcommand === 'end') {
            const messageId = options.getString('message_id');
            const giveaway = giveaways.get(messageId);

            if (!giveaway || giveaway.ended) {
                return interaction.reply({ content: 'This giveaway is not active or does not exist.', ephemeral: true });
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
                return interaction.reply({ content: 'No one entered the giveaway.', ephemeral: true });
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
                .setTitle('🎉 Giveaway Ended! 🎉')
                .setDescription(`Winner: ${winner}!\nPrize: **${giveaway.prize}**`)
                .setColor('Random')
                .setTimestamp();

            await interaction.channel.send({ embeds: [winnerEmbed] });
            giveawayMessage.edit({ components: [] });
            await interaction.reply({ content: 'Giveaway ended!', ephemeral: true });

        } else if (subcommand === 'weight') {
            const messageId = options.getString('message_id');
            const user = options.getUser('user');
            const weight = options.getInteger('weight');

            const giveaway = giveaways.get(messageId);
            if (!giveaway) {
                return interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
            }

            if (weight <= 0) {
                return interaction.reply({ content: 'Weight must be a positive number.', ephemeral: true });
            }

            giveaway.weights.set(user.id, weight);
            await interaction.reply({ content: `Set weight for user ${user} to ${weight} in giveaway ${messageId}.`, ephemeral: true });

        } else if (subcommand === 'pick') {
            const messageId = options.getString('message_id');
            const user = options.getUser('user');
            const probability = options.getInteger('probability');

            const giveaway = giveaways.get(messageId);
            if (!giveaway) {
                return interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
            }

            if (probability < 0 || probability > 100) {
                return interaction.reply({ content: 'Probability must be between 0 and 100.', ephemeral: true });
            }

            giveaway.pickedUser = { id: user.id, probability: probability };
            await interaction.reply({ content: `User ${user} has a ${probability}% chance to win giveaway ${messageId}.`, ephemeral: true });
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
