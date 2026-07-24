using System.Reflection;
using System.Runtime.Serialization.Formatters.Binary;

unsafe class Program {
    object Load(byte[] payload) {
        Assembly.Load(payload);
        return new BinaryFormatter();
    }
}
