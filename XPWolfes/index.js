const {Client, GatewayIntentBits, Application, ReactionCollector, Message, userMention, Collection, roleMention, Intents} = require('discord.js');
const {REST} = require("@discordjs/rest");
const {Routes} = require("discord-api-types/v9");
const fs = require("fs");
const { randomInt } = require('crypto');
const mongo = require("./mongo");
const TimedMessage = require("./TimedEvents/TimedMessages")
const gen = require("./generalfunctions")


require('dotenv/config');

    const client = new Client({ intents: [32767, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

    ///Command handler
    const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
    const menu_interactions = fs.readdirSync("./DropdownInteraction").filter(file => file.endsWith(".js"));
    const commands = [];
    client.commands = new Collection();
    client.menu_ints = new Collection();
    
    //Settings
    channel = undefined;
    role = undefined;
    const messages = []
    const callout = []

    for(const file of commandFiles){
        const command = require(`./commands/${file}`);
        commands.push(command.data.toJSON());
        client.commands.set(command.data.name, command);
    }

    for(const file of menu_interactions){
        const menu_int = require(`./DropdownInteraction/${file}`);
        client.menu_ints.set(menu_int.data.customId, menu_int);
    }

    client.on('ready', async () => {
        console.log('the bot is ready');
        await mongo().then(mongoose =>
            {
                try{
                    mongoose.set('strictQuery', false);
                    console.log("connected to mongo")
                }
                finally{
                    //mongoose.connection.close();
                }
            })

        const CLIENT_ID = client.user.id;

        const rest = new REST({
            version: "9"
        }).setToken(process.env.TOKEN);

        (async () =>{
            try{
                if(process.env.ENV === "production"){
                    await rest.put(Routes.applicationCommands(CLIENT_ID), {
                        body: commands
                    });
                    console.log("succesfully registered commands global")
                } else{
                    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, process.env.GUILD_ID), {
                        body: commands
                    });
                    console.log("succesfully registered commands Local")
                }
            }
            catch(err){
                if(err) {console.error(err);}
             }
        })();
        
        (async () =>{
            try{
                await client.commands.forEach(async command => {
                    if(typeof command.startup !== "undefined"){
                        await command.startup()
                    }
                });
            }
            catch(err){
                if(err) {
                    console.error(err);
                }
            }
        })();
    })

    client.on("interactionCreate", async interaction => {
        if(!interaction.isCommand() && !interaction.isAnySelectMenu()) return;

        if(interaction.isCommand()){
            const command = client.commands.get(interaction.commandName);

            if(!command) return;

            try{
                await command.execute(interaction, client);
            }
            catch (err){
                if(err){ console.error(err);}

                await interaction.reply({
                    content: "An error occured",
                    ephemeral: true
                })
            }
        }

        if(interaction.isStringSelectMenu()){
            
            const ddInteract = client.ddInts.get(interaction.customId);
            if(!ddInteract) return await interaction.reply({content: "There is no interaction like this", ephemeral: true}); 

            try{
                await ddInteract.execute(interaction, client);
            }
            catch (err){
                if(err){ console.error(err);}

                await interaction.reply({
                    content: "An error occured",
                    ephemeral: true
                })
            }

        }
    })
    
    //////////////////////////////////////////////////////////////////
    //                      Timed Message                           //
    //////////////////////////////////////////////////////////////////
    
    const date = new Date();
    setTimeout(function() {
        setInterval(newTimedMessage, 60000);
        newTimedMessage();
    }, (60 - date.getSeconds()) * 1000);


    async function newTimedMessage(){
        TimedMessage.execute(client);
    }

    client.login(process.env.TOKEN)


