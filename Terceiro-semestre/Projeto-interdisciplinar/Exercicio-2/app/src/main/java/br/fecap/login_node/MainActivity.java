package br.fecap.login_node;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import java.util.HashMap;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class MainActivity extends AppCompatActivity {

    private Retrofit retrofit;
    private RetrofitInterface retrofitInterface;
    private String BASE_URL = "https://89v9gt-8080.csb.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        retrofit = new Retrofit.Builder().baseUrl(BASE_URL).addConverterFactory(GsonConverterFactory.create()).build();

        retrofitInterface = retrofit.create(RetrofitInterface.class);

        findViewById(R.id.btn_login).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                handleLoginDialog();
            }
        });

        findViewById(R.id.btn_singup).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                handleSingupDialog();
            }
        });

    }

    private void handleLoginDialog() {
        View view = getLayoutInflater().inflate(R.layout.login_dialog, null);
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setView(view).show();
        Button loginButton = view.findViewById(R.id.btn_loginDialog);
        EditText emailEdit = view.findViewById(R.id.edit_emailLogin);
        EditText passEdit = view.findViewById(R.id.edit_passLogin);

        loginButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                HashMap<String, String> map = new HashMap<>();

                map.put("email", emailEdit.getText().toString());
                map.put("senha", passEdit.getText().toString());

                Call<LoginResult> call = retrofitInterface.executeLogin(map);
                call.enqueue(new Callback<LoginResult>() {
                    @Override
                    public void onResponse(Call<LoginResult> call, Response<LoginResult> response) {
                        if(response.code() == 200){
                            LoginResult result = response.body();
                            AlertDialog.Builder builder1 = new AlertDialog.Builder(MainActivity.this);
                            builder1.setTitle("Login realizado com sucesso!");
                            builder1.setMessage("Status code: " + response.code());
                            builder1.show();

                        } else if (response.code() == 404) {
                            Toast.makeText(MainActivity.this, "Dados incorretos", Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<LoginResult> call, Throwable t) {
                        Toast.makeText(MainActivity.this, t.getMessage(), Toast.LENGTH_LONG).show();
                        System.out.println(t.toString());
                    }
                });

            }
        });

    }

    private void handleSingupDialog() {
        View view = getLayoutInflater().inflate(R.layout.singup_dialog, null);
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setView(view).show();

        Button signupButton = view.findViewById(R.id.btn_singupDialog);
        EditText nameEdit = view.findViewById(R.id.edit_nameSingup);
        EditText emailEdit = view.findViewById(R.id.edit_emailSingup);
        EditText passEdit = view.findViewById(R.id.edit_passSingup);

        signupButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                HashMap<String, String> map = new HashMap<>();
                map.put("nome", nameEdit.getText().toString());
                map.put("email", emailEdit.getText().toString());
                map.put("senha", passEdit.getText().toString());

                Call<Void> call = retrofitInterface.executeSingup(map);
                call.enqueue(new Callback<Void>() {
                    @Override
                    public void onResponse(Call<Void> call, Response<Void> response) {
                        if(response.code() == 200){
                            Toast.makeText(MainActivity.this, "Singup feito com sucesso!", Toast.LENGTH_SHORT).show();
                        } else if (response.code() == 400) {
                            Toast.makeText(MainActivity.this, "Conta ja existente!", Toast.LENGTH_SHORT).show();
                            
                        }
                    }

                    @Override
                    public void onFailure(Call<Void> call, Throwable t) {
                        Toast.makeText(MainActivity.this, t.getMessage(), Toast.LENGTH_LONG).show();
                        System.out.println(t.toString());
                    }
                });
            }
        });
    }


}