const {SlashCommandBuilder, roleMention} = require("@discordjs/builders");
const mongo = require("../mongo");
const { PermissionFlagsBits, Colors } = require("discord.js");
const gen = require("../generalfunctions.js");
const gameData = require("../Schemas/game-data");
const roleData = require("../Schemas/roles-schema")
const users = require("../Schemas/users");
const voteData = require("../Schemas/vote-schema");
const rolesSchema = require("../Schemas/roles-schema");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("pacifist")
        .setDescription("update a specific value")
        .addSubcommand(subcommand =>
            subcommand.setName('force_abstain')
                .setDescription('Choose 2 players to force abstain')
                .addUserOption(option => 
                    option.setName("target-one")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
                .addUserOption(option => 
                    option.setName("target-two")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                switch(options.getSubcommand())
                    {
                        case "force_abstain":
                            await HandleForceAbstain(interaction, guild, client, options)
                            return;
                    }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    }
}

async function HandleForceAbstain(interaction, guild, client, options){

    //Check if game is active
    const game = await gameData.findOne({_id: guild.id})
    if(!game){
        await gen.reply(interaction, "There is no game.")
        return;
    }
    //Check if can vote
    if(!game.canVote){
        await gen.reply(interaction, "You are not able to vote yet")
        return;
    }
    //Check if command user is pacifist
    const role = await roleData.findOne({guildID: guild.id, roleName: "pacifist"});
    if(!role) {
        await console.log("The pacifist role does not exist.");
        return;
    }
    if(!role.roleMembers.includes(interaction.user.id)) {
        await gen.reply("You are not the pacifist and cannot use this command")
        return;
    }

    //are targets in game or dead
    const targetOne = await users.findOne({_id: options.getUser("target-one").id})
    const targetTwo = await users.findOne({_id: options.getUser("target-two").id})
    if(!targetOne) {
        gen.reply(interaction, "Your fist target is not in the game");
        return;
    }
    if(!targetTwo) {
        gen.reply(interaction, "Your second target is not in the game");
        return;
    }
    if(targetOne.dead){
        gen.reply(interaction, "Your fist target is already dead");
        return;
    }
    if(targetTwo.dead){
        gen.reply(interaction, "Your second target is already dead");
        return;
    }

    //set targets in database
    await rolesSchema.updateOne(
        {guildID: guild.id, roleName: "pacifist"}, 
        {$set: 
            {
                specialFunctions: [{targetOne: "", targetTwo: ""}]
            }
        },
        {upsert: true}
    )
    await rolesSchema.updateOne(
        {guildID: guild.id, roleName: "pacifist", "specialFunctions.targetOne": "", "specialFunctions.targetTwo": "" }, 
        {$set: 
            {
                "specialFunctions.$.targetOne": options.getUser("target-one").id,
                "specialFunctions.$.targetTwo": options.getUser("target-two").id,
            }
        },
        {upsert: true}
    )

    await gen.SendFeedback(guild.id, "PACIFIST ACTION", `**${gen.getName(interaction, options.getUser("target-one").id)}** and **${gen.getName(interaction, options.getUser("target-two").id)}** are forced to abstain`, client, Colors.Blue)
    await gen.SendToChannel(role.channelID, "PEACE BY FORCE", `You have chosen to make **${gen.getName(interaction, options.getUser("target-one").id)}** and **${gen.getName(interaction, options.getUser("target-two").id)}** abstain`, client, Colors.Green)
}

