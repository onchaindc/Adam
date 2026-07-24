import java.io.ObjectInputStream;
import java.sql.Statement;

class App {
  Object read(ObjectInputStream input) throws Exception {
    return input.readObject();
  }

  void query(Statement statement, String user) throws Exception {
    statement.executeQuery("SELECT * FROM users WHERE name = '" + user + "'");
  }
}
