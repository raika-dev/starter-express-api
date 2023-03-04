import { UserDB, IUser } from "../models/User";

export const userService = {
  createUser: async (address: string) => {
    console.log("Add user", address);
    if (!address) throw "empty address";
    const user: IUser = {
      address: address,
      name: address,
      balance: 10000,
      avatarUrl: "",
    }
    try {
      await UserDB.create(user);
    } catch (err: any) {
      console.log("Error on creating a user");
      console.error(err);
    }
    return user;
  },

  getUser: async (address: string) => {
    try {
      const user: IUser | null = await UserDB.findOne({ address });
      if (!user) {
        return await userService.createUser(address);
      }
      return user;
    } catch (err) {
      console.log("Error on getting user");
      console.error(err);
    }
    return await userService.createUser(address);
  },

  updateUser: async (user: IUser) => {
    await UserDB.findOneAndUpdate({ address: user.address }, user);
  }
}
