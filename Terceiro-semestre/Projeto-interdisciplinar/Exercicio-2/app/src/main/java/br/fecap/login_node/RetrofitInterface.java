package br.fecap.login_node;

import retrofit2.Call;
import retrofit2.http.POST;
import retrofit2.http.Body;

import java.util.HashMap;

public interface RetrofitInterface {

    @POST("/login")
    Call<LoginResult> executeLogin(@Body HashMap <String, String> map);

    @POST("/register")
    Call<Void> executeSingup (@Body HashMap <String, String> map);

}
