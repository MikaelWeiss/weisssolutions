defmodule WeisssolutionsWeb.WorkController do
  use WeisssolutionsWeb, :controller

  def index(conn, _params) do
    render(conn, :index)
  end
end
