const mongo = require("../mongo");
const gameData = require("../Schemas/game-data")
const rolesData = require("../Schemas/roles-schema");
const usersData = require("../Schemas/users")
const gen = require("../generalfunctions.js");
const { userMention, Colors } = require("discord.js");


async function morningLoop(client, games){
    games.forEach(async game => {
        await handleMorning(client, game)
    });
}

async function handleMorning(client, game){
    //Increase the day count
    await gameData.updateMany({started: true, finished: false}, {$inc: {day: 1}}, {options: {upsert: true}})
    
    //Kill people from the night
    //Check for lovers death
    await killNightKilled(client, game)
    await checkLovers(client, game)

    //Open village chat

    //Send msg to people with day abilities that they can use it.


    gen.SendFeedback(game._id, "New Day", game.day + " has started", client);






    
    // //Send day inc feedback
    // 
    

    // 

    // await SendNewspaper(client, game)
}

async function checkLovers(client, game){
    const cupid = await rolesData.findOne({guildID: game._id, roleName: "cupid"});
    const LoversInfo = cupid.specialFunctions[0];


    if(!cupid || LoversInfo.lovers.length < 1){
        console.log("no lovers or cupid")
        return;
    }
    if(LoversInfo.loversDead){
        return;
    }

    //Check lovers
    const l1 = await users.findOne({guildID: game._id, _id: LoversInfo.lovers[0]})
    const l2 = await users.findOne({guildID: game._id, _id: LoversInfo.lovers[1]})
    
    if(!l1 || !l2){
        console.log("no lover user info found")
        return;
    }
    
    if(l1.dead){
        await gen.Kill(l1._id, game._id, client)
        gen.SendFeedback(game._id, "LOVER DIED", "The second lover has commited sudoku", client, Colors.Red);
        await rolesData.updateOne({guildID: game._id}, {$set: {specialFunctions: [{loversDead: true}]}}, {options: {upsert: true}});
    }
    if(l2.dead){
        await gen.addToNightKilled(l1._id, game._id, client, "Supuku because their lover died")
        gen.SendFeedback(game._id, "LOVER DIED", "The second lover has commited sudoku", client, Colors.Red);
        await rolesData.updateOne({guildID: game._id}, {$set: {specialFunctions: [{loversDead: true}]}}, {options: {upsert: true}})
    }
}

async function killNightKilled(client, game){
    const updatedGame = await gameData.findOne({_id: game._id})

    if(!updatedGame.nightKilled){
        console.log("Game does not exist")
        return;
    }

    if(updatedGame.nightKilled.length < 1){
        await gen.SendFeedback(game._id, "NEW DAY, NO DEATH?", "It was awfully quiet tonight, nobody died! \n No one died", client);
        return;
    }

    let msg = "Killed people: \n"

    updatedGame.nightKilled.forEach(async killedPerson => {
        msg = msg + `${userMention(killedPerson.id)} - killed by ${killedPerson.cause} \n`
        await gen.Kill(killedPerson.id, game._id, client);
    })

    await gameData.updateOne({_id: game._id}, {$set: {nightKilled: []}}, {options: {upsert: true}})
    await gen.SendFeedback(game._id, "NEW DAY, NEW DEATH", msg, client);
}


module.exports = {
    morningLoop,
    handleMorning
}